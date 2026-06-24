"""Composio OAuth router — uses Composio v3 REST API directly.

Flow:
1. GET /api/v3/auth_configs?toolkit[slug]=googlesheets — find or create auth config
2. POST /api/v3/connected_accounts/link — get redirect URL for user OAuth
3. GET /api/v3/connected_accounts?entity_id=<user_id> — check connection status
"""
from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.dependencies import get_current_user

router = APIRouter()

BASE = "https://backend.composio.dev/api/v3"
# Cached auth config ID for googlesheets (created once per Composio account)
_GOOGLESHEETS_AUTH_CONFIG_ID: str | None = None


def _headers(api_key: str) -> dict:
    return {"x-api-key": api_key, "Content-Type": "application/json"}


async def _get_or_create_auth_config(api_key: str) -> str:
    """Get or create a Composio-managed auth config for Google Sheets."""
    global _GOOGLESHEETS_AUTH_CONFIG_ID
    if _GOOGLESHEETS_AUTH_CONFIG_ID:
        return _GOOGLESHEETS_AUTH_CONFIG_ID

    async with httpx.AsyncClient(timeout=15) as client:
        # Check existing auth configs
        r = await client.get(
            f"{BASE}/auth_configs",
            headers=_headers(api_key),
            params={"toolkit[slug]": "googlesheets"},
        )
        if r.status_code == 200:
            items = r.json().get("items", [])
            for item in items:
                ac = item.get("auth_config", item)
                if ac.get("is_composio_managed"):
                    _GOOGLESHEETS_AUTH_CONFIG_ID = ac["id"]
                    return _GOOGLESHEETS_AUTH_CONFIG_ID

        # Create new managed auth config
        r = await client.post(
            f"{BASE}/auth_configs",
            headers=_headers(api_key),
            json={"toolkit": {"slug": "googlesheets"}, "use_composio_auth": True},
        )
        if r.status_code not in (200, 201):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to create Composio auth config: {r.text[:200]}",
            )
        data = r.json()
        _GOOGLESHEETS_AUTH_CONFIG_ID = data["auth_config"]["id"]
        return _GOOGLESHEETS_AUTH_CONFIG_ID


@router.post("/composio/connect")
async def composio_connect(
    user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Initiate Google Sheets OAuth — returns redirect URL for user to authorize."""
    settings = get_settings()
    user_id: str = user["user_id"]

    try:
        auth_config_id = await _get_or_create_auth_config(settings.composio_api_key)

        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{BASE}/connected_accounts/link",
                headers=_headers(settings.composio_api_key),
                json={
                    "auth_config_id": auth_config_id,
                    "user_id": user_id,
                    "redirect_uri": f"{settings.frontend_url}/settings?composio=connected",
                },
            )
            if r.status_code not in (200, 201):
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Composio link error {r.status_code}: {r.text[:200]}",
                )
            data = r.json()
            redirect_url = data.get("redirect_url", "")
            if not redirect_url:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"No redirect_url in response: {data}",
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Composio connect failed: {exc}",
        ) from exc

    return {"redirect_url": redirect_url}


@router.get("/composio/status")
async def composio_status(
    user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Check if user has an active Google Sheets connection."""
    settings = get_settings()
    user_id: str = user["user_id"]

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{BASE}/connected_accounts",
                headers=_headers(settings.composio_api_key),
                params={"entity_id": user_id, "toolkit[slug]": "googlesheets"},
            )
            if r.status_code != 200:
                return {"connected": False}

            items = r.json().get("items", [])
            connected = any(
                item.get("status") == "ACTIVE" for item in items
            )
    except Exception:
        return {"connected": False}

    return {"connected": connected}
