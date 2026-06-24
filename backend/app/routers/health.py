from typing import Annotated
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@router.get("/api/v1/me")
def me(user: Annotated[dict, Depends(get_current_user)]):
    """Debug: returns the decoded JWT claims. Use to verify auth works."""
    return {"user_id": user["user_id"], "email": user["email"], "auth": "ok"}
