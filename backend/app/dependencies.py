"""FastAPI dependency functions — JWT authentication and plan-gate enforcement."""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client

from app.config import get_settings

security = HTTPBearer()

FREE_PLAN_LIMIT = 2
PLAN_LIMITS: dict[str, int] = {
    "free": 2,
    "starter": 25,
    "standard": 50,
    "pro": 120,
}
UPGRADE_URL = "http://localhost:3000/settings/billing"


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> dict:
    """Verify JWT by calling Supabase get_user(token).

    Works with both HS256 (old projects) and ES256 (new projects).
    No local key management needed — Supabase validates the signature.
    """
    settings = get_settings()
    token = credentials.credentials

    try:
        sb = create_client(settings.supabase_url, settings.supabase_service_key)
        response = sb.auth.get_user(token)
        user = response.user
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {"user_id": user.id, "email": user.email}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def check_plan_gate(
    file_count: int,
    user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    settings = get_settings()
    sb = create_client(settings.supabase_url, settings.supabase_service_key)
    user_id: str = user["user_id"]

    try:
        result = (
            sb.table("subscriptions")
            .select("plan, pdf_limit, status")
            .eq("user_id", user_id)
            .eq("status", "active")
            .single()
            .execute()
        )
        row: Optional[dict] = result.data
    except Exception:
        row = None

    if row is None:
        plan = "free"
        pdf_limit = FREE_PLAN_LIMIT
    else:
        plan = row.get("plan") or "free"
        pdf_limit = int(row.get("pdf_limit") or FREE_PLAN_LIMIT)

    # Count PDFs used this billing period from usage_logs
    try:
        used_result = (
            sb.table("usage_logs")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("status", "success")
            .execute()
        )
        used = used_result.count or 0
    except Exception:
        used = 0

    if used + file_count > pdf_limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "plan_limit_exceeded",
                "plan": plan,
                "used": used,
                "limit": pdf_limit,
                "requested": file_count,
                "upgrade_url": UPGRADE_URL,
            },
        )

    return user
