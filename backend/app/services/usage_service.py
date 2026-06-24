"""Usage tracking service — reads and writes usage_logs via Supabase.

Privacy note: raw file bytes are NEVER stored.  Only the SHA-256 hash of the
file content is persisted to usage_logs, solely for deduplication auditing.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from supabase import create_client, Client

from app.config import get_settings


def _get_client() -> Client:
    """Create and return a Supabase service-role client."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_key)


async def get_usage(user_id: str) -> dict[str, Any]:
    """Query the ``usage_this_period`` view for the given user.

    Returns the row dict if found, or an empty dict when the user has no
    recorded usage yet (e.g. new account or first billing period).
    Never raises — failures are silently swallowed so they cannot block
    request processing.
    """
    client = _get_client()
    try:
        result = (
            client.table("usage_this_period")
            .select("*")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        return result.data or {}
    except Exception:
        return {}


async def increment_usage(
    user_id: str,
    doc_type: str,
    filename_hash: str,
    status: str,
) -> None:
    """Insert a single event into ``usage_logs``.

    Columns written:
    - id            — random UUID (primary key)
    - user_id       — Supabase auth user id
    - doc_type      — parser key (esic, pf_ecr, …)
    - filename_hash — SHA-256 hex digest of the file content (NOT the filename)
    - status        — "success", "image_pdf", "parse_error", etc.
    - created_at    — UTC timestamp as ISO-8601 string

    Raw file content is NEVER stored.  Failures are silently ignored so that
    usage-logging errors cannot break the parse response returned to the client.
    """
    client = _get_client()
    try:
        client.table("usage_logs").insert(
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "doc_type": doc_type,
                "filename_hash": filename_hash,
                "status": status,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
    except Exception:
        # Do not let usage-logging failures propagate to the caller
        pass
