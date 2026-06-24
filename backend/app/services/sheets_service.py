"""Google Sheets export service — uses Composio v3 REST API directly."""
from __future__ import annotations

from typing import Any, Optional

import httpx

from app.config import get_settings

BASE = "https://backend.composio.dev/api/v3"


def _headers(api_key: str) -> dict:
    return {"x-api-key": api_key, "Content-Type": "application/json"}


async def _get_connected_account_id(api_key: str, user_id: str) -> str:
    """Get the user's active Google Sheets connected account ID."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{BASE}/connected_accounts",
            headers={"x-api-key": api_key},
            params={"user_id": user_id, "toolkit_slug": "googlesheets"},
        )
        r.raise_for_status()
        items = r.json().get("items", [])
        active = [i for i in items if i.get("status") == "ACTIVE"]
        if not active:
            raise ValueError("No active Google Sheets connection found. Please connect Google Sheets first.")
        return active[0]["id"]


async def _execute_tool(api_key: str, connected_account_id: str, tool_slug: str, arguments: dict, user_id: str = "") -> dict:
    """Execute a Composio tool via v3 REST API. Raises on HTTP error OR successful=false."""
    async with httpx.AsyncClient(timeout=30) as client:
        payload: dict = {
            "connected_account_id": connected_account_id,
            "arguments": arguments,
        }
        if user_id:
            payload["user_id"] = user_id
        r = await client.post(
            f"{BASE}/tools/execute/{tool_slug}",
            headers=_headers(api_key),
            json=payload,
        )
        if not r.is_success:
            raise RuntimeError(f"Tool {tool_slug} failed {r.status_code}: {r.text[:200]}")
        data = r.json()
        if not data.get("successful", True):
            raise RuntimeError(f"Tool {tool_slug} error: {data.get('error', data)}")
        return data


async def write_to_sheets(
    user_id: str,
    doc_type: str,
    rows: list[dict[str, Any]],
    spreadsheet_id: Optional[str] = None,
) -> dict[str, str]:
    """Write rows to Google Sheets via Composio v3 REST API."""
    if not rows:
        raise ValueError("No rows to write.")

    settings = get_settings()
    api_key = settings.composio_api_key

    # Get connected account
    ca_id = await _get_connected_account_id(api_key, user_id)

    # Build clean headers (skip internal _ prefixed fields)
    headers_list = [k for k in rows[0].keys() if not k.startswith("_")]
    sheet_title = f"StatutorySync - {doc_type.upper()[:80]}"
    json_data = [dict(zip(headers_list, [str(row.get(h, "")) for h in headers_list])) for row in rows]

    # SHEET_FROM_JSON creates a new spreadsheet AND populates it in one call.
    # Do NOT pre-create with CREATE_GOOGLE_SHEET1 — that produces an empty duplicate.
    result = await _execute_tool(api_key, ca_id, "GOOGLESHEETS_SHEET_FROM_JSON", {
        "title": sheet_title,
        "sheet_name": doc_type.upper()[:100],
        "sheet_json": json_data,
    }, user_id=user_id)

    # Extract spreadsheetId from response
    rd = result.get("data", {}).get("response_data", {})
    out_id = (
        rd.get("spreadsheetId")
        or rd.get("spreadsheet_id")
        or spreadsheet_id
        or ""
    )

    return {
        "spreadsheet_id": out_id,
        "sheet_url": f"https://docs.google.com/spreadsheets/d/{out_id}" if out_id else "",
    }
