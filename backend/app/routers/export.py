"""Export router — Excel download and Google Sheets push."""
from __future__ import annotations

import io
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.dependencies import get_current_user
from app.models.requests import ExcelExportRequest, SheetsExportRequest
from app.models.responses import SheetsExportResponse
from app.services import excel_service, sheets_service

router = APIRouter()


@router.post(
    "/export/excel",
    summary="Export parsed rows to an Excel (.xlsx) file",
    response_description="A styled Excel workbook as an attachment",
)
async def export_excel(
    request: ExcelExportRequest,
    _user: Annotated[dict, Depends(get_current_user)],
) -> StreamingResponse:
    """Build a styled xlsx workbook from the provided rows and return it as a
    file download.

    The sheet tab is named after *doc_type*. The response includes a
    ``Content-Disposition: attachment`` header so browsers prompt a save dialog.
    """
    if not request.rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No rows provided for export.",
        )

    xlsx_bytes: bytes = excel_service.build_excel(request.doc_type, request.rows)
    safe_doc_type = request.doc_type.replace("/", "_").replace("..", "")
    filename = f"{safe_doc_type}_export.xlsx"

    return StreamingResponse(
        content=io.BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(xlsx_bytes)),
        },
    )


@router.post(
    "/export/sheets",
    response_model=SheetsExportResponse,
    summary="Push parsed rows to Google Sheets via Composio",
)
async def export_sheets(
    request: SheetsExportRequest,
    user: Annotated[dict, Depends(get_current_user)],
) -> SheetsExportResponse:
    """Write rows to a Google Spreadsheet using the user's connected Composio
    entity.

    If *spreadsheet_id* is omitted a new spreadsheet is created.
    Returns the spreadsheet id and a direct URL to the sheet.
    """
    if not request.rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No rows provided for export.",
        )

    try:
        result = await sheets_service.write_to_sheets(
            user_id=user["user_id"],
            doc_type=request.doc_type,
            rows=request.rows,
            spreadsheet_id=request.spreadsheet_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Google Sheets export failed: {exc}",
        ) from exc

    return SheetsExportResponse(**result)
