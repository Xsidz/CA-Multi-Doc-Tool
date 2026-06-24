"""Parse router — accepts multipart PDF uploads and returns structured rows."""
from __future__ import annotations

from typing import Annotated, List

from fastapi import APIRouter, Depends, File, HTTPException, Path, UploadFile, status

from app.config import get_settings
from app.dependencies import check_plan_gate, get_current_user
from app.models.responses import ParseBatchResponse
from app.parsers.registry import PARSER_REGISTRY, PLAN_LIMITS
from app.services import pdf_service, usage_service

router = APIRouter()


@router.get("/usage", summary="Get current usage for the authenticated user")
async def get_usage(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    """Return { pdfs_used, pdf_limit, plan } for the current billing period.

    Falls back to free plan defaults when no subscription row exists yet.
    Safe to call unauthenticated — returns 401 via the dependency.
    """
    data = await usage_service.get_usage(user["user_id"])
    plan = data.get("plan", "free")
    # After view fix: column is pdf_limit. Old view had plan_limit. Fall back to constants.
    pdf_limit = data.get("pdf_limit") or data.get("plan_limit") or PLAN_LIMITS.get(plan, 2)
    files_used = data.get("files_used", 0) or 0
    return {
        "pdfs_used": files_used,
        "pdf_limit": pdf_limit,
        "plan": plan,
    }

_settings = get_settings()
MAX_FILE_SIZE_BYTES: int = _settings.max_file_size_bytes
MAX_FILE_COUNT: int = _settings.max_files_per_request


@router.post(
    "/parse/{doc_type}",
    response_model=ParseBatchResponse,
    summary="Parse a batch of statutory-dues PDFs",
    description=(
        "Upload one or more PDF files of the given *doc_type* "
        "(esic, pf_ecr, ptrc, tds, gstr3b). "
        "Returns structured rows ready for export."
    ),
)
async def parse_documents(
    doc_type: Annotated[
        str,
        Path(
            description="Document type key. One of: esic, pf_ecr, ptrc, tds, gstr3b",
        ),
    ],
    files: Annotated[
        List[UploadFile],
        File(description="One or more PDF files (max 10 MB each, max 20 per request)"),
    ],
    user: Annotated[dict, Depends(get_current_user)],
) -> ParseBatchResponse:
    """Parse batch endpoint.

    Validation order:
    1. doc_type must exist in PARSER_REGISTRY
    2. File count must not exceed MAX_FILE_COUNT
    3. Plan gate must allow the requested file count
    4. Each file must be ≤ MAX_FILE_SIZE_BYTES
    5. Delegate to pdf_service.parse_batch
    """
    # ── 1. Validate doc_type ────────────────────────────────────────────────
    if doc_type not in PARSER_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unknown doc_type '{doc_type}'. "
                f"Valid types: {sorted(PARSER_REGISTRY.keys())}"
            ),
        )

    # ── 2. Validate file count ──────────────────────────────────────────────
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one file is required.",
        )

    if len(files) > MAX_FILE_COUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Too many files. Maximum {MAX_FILE_COUNT} files allowed per request, "
                f"but {len(files)} were provided."
            ),
        )

    # ── 3. Plan gate (checks usage_this_period in Supabase) ─────────────────
    check_plan_gate(len(files), user)

    # ── 4. Read all file bytes and enforce per-file size limit ──────────────
    files_bytes: List[bytes] = []
    filenames: List[str] = []

    for upload_file in files:
        raw = await upload_file.read()
        if len(raw) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    f"File '{upload_file.filename}' is "
                    f"{len(raw) // 1024 // 1024:.1f} MB which exceeds the 10 MB limit."
                ),
            )
        files_bytes.append(raw)
        filenames.append(upload_file.filename or "unknown.pdf")

    # ── 5. Parse ────────────────────────────────────────────────────────────
    result: ParseBatchResponse = await pdf_service.parse_batch(
        doc_type=doc_type,
        files_bytes=files_bytes,
        filenames=filenames,
        user_id=user["user_id"],
    )

    return result
