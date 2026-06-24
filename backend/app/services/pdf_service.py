"""PDF parsing service — orchestrates parser calls, ESIC grouping, FY sorting,
and usage tracking.
"""
from __future__ import annotations

import hashlib
from typing import Any

from app.models.responses import ParseBatchResponse
from app.parsers.registry import PARSER_REGISTRY
from app.services import usage_service

# ── Financial-year month ordering (APR = 1 … MAR = 12) ────────────────────────
MONTH_FY_ORDER: dict[str, int] = {
    "APR": 1, "APRIL": 1,
    "MAY": 2,
    "JUN": 3, "JUNE": 3,
    "JUL": 4, "JULY": 4,
    "AUG": 5, "AUGUST": 5,
    "SEP": 6, "SEPTEMBER": 6,
    "OCT": 7, "OCTOBER": 7,
    "NOV": 8, "NOVEMBER": 8,
    "DEC": 9, "DECEMBER": 9,
    "JAN": 10, "JANUARY": 10,
    "FEB": 11, "FEBRUARY": 11,
    "MAR": 12, "MARCH": 12,
}

# Field names that could carry the FY / year string (checked in order)
_FY_FIELDS = ("Year", "Financial_Year", "FY", "Financial Year", "Wage Month",
              "Contribution Period", "Period", "Tax Period", "Assessment Year")

# Field names that could carry the month string
_MONTH_FIELDS = ("Month", "PTRC return for the month", "Wage Month",
                 "Contribution Period", "Period")


def _fy_sort_key(row: dict[str, Any]) -> tuple[str, int]:
    """Return (financial_year_str, fy_month_index) for stable cross-FY ordering.

    Unknown values sort to the end.
    """
    fy_str = ""
    for field in _FY_FIELDS:
        v = row.get(field)
        if v and str(v).strip() and str(v).strip() not in ("Unknown", "ERROR"):
            fy_str = str(v).strip()
            break

    month_idx = 99
    for field in _MONTH_FIELDS:
        v = row.get(field)
        if v:
            # Normalise: take first 3 chars uppercase; also handle "April 2024" style
            token = str(v).strip().split()[0].upper()[:3]
            idx = MONTH_FY_ORDER.get(token)
            if idx is not None:
                month_idx = idx
                break

    return (fy_str, month_idx)


# ── ESIC-specific grouping ────────────────────────────────────────────────────

def _apply_esic_grouping(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group ESIC rows by (Year, Month) then label Employer / Employee.

    Within each group, sort by "Total ESIC Contribution Paid" descending.
    The highest contribution in the group is labelled Employer;
    the second-highest is labelled Employee.
    Groups are then sorted chronologically by FY order.

    Returns a flat list of all processed rows.
    """
    from collections import defaultdict

    # Build groups keyed by (Year, Month)
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        year_key = str(row.get("Year") or "Unknown")
        month_key = str(row.get("Month") or "Unknown")
        groups[(year_key, month_key)].append(row)

    output_rows: list[dict[str, Any]] = []

    for (year_key, month_key), group_rows in groups.items():
        # Sort by contribution descending within the group
        sorted_group = sorted(
            group_rows,
            key=lambda r: float(r.get("Total ESIC Contribution Paid") or 0),
            reverse=True,
        )

        for rank_idx, row in enumerate(sorted_group):
            enriched = dict(row)
            if rank_idx == 0:
                enriched["Contribution Type"] = "Employer"
            elif rank_idx == 1:
                enriched["Contribution Type"] = "Employee"
            else:
                enriched["Contribution Type"] = f"Other-{rank_idx}"
            output_rows.append(enriched)

    # Sort output groups chronologically by FY month order
    output_rows.sort(key=_fy_sort_key)
    return output_rows


# ── Main batch-parse function ─────────────────────────────────────────────────

async def parse_batch(
    doc_type: str,
    files_bytes: list[bytes],
    filenames: list[str],
    user_id: str,
) -> ParseBatchResponse:
    """Parse a list of files using the registered parser for *doc_type*.

    For ESIC, applies the employer/employee grouping logic after all files
    have been parsed.  For all other types, rows are sorted by FY + month.

    Usage events are logged to Supabase (filename SHA-256 only — no file content
    is stored).

    Returns a :class:`ParseBatchResponse` containing all rows plus any
    error file names.
    """
    parser = PARSER_REGISTRY[doc_type]
    all_rows: list[dict[str, Any]] = []
    error_files: list[str] = []

    for file_bytes, filename in zip(files_bytes, filenames):
        # Hash the file content for usage logging — never store raw bytes
        filename_hash = hashlib.sha256(file_bytes).hexdigest()

        try:
            parsed_rows: list[dict[str, Any]] = parser(file_bytes)
            # Tag each row with its source filename for traceability
            for r in parsed_rows:
                r.setdefault("_source_file", filename)
            all_rows.extend(parsed_rows)
            await usage_service.increment_usage(
                user_id=user_id,
                doc_type=doc_type,
                filename_hash=filename_hash,
                status="success",
            )

        except ValueError as exc:
            error_type = str(exc)
            error_files.append(f"{filename}: {error_type}")
            await usage_service.increment_usage(
                user_id=user_id,
                doc_type=doc_type,
                filename_hash=filename_hash,
                status=error_type[:64],
            )

        except Exception as exc:
            error_files.append(f"{filename}: parse_error ({exc})")
            await usage_service.increment_usage(
                user_id=user_id,
                doc_type=doc_type,
                filename_hash=filename_hash,
                status="parse_error",
            )

    # ── Post-processing ─────────────────────────────────────────────────────
    if doc_type == "esic":
        all_rows = _apply_esic_grouping(all_rows)
    else:
        # Sort by financial year string + FY month index
        try:
            all_rows.sort(key=_fy_sort_key)
        except Exception:
            # Never let sorting crash the response
            pass

    return ParseBatchResponse(
        doc_type=doc_type,
        rows=all_rows,
        error_files=error_files,
        total_parsed=len(all_rows),
    )
