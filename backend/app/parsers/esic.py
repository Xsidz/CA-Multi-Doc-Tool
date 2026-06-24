"""ESIC Payment Receipt PDF parser.

Ports the Power Query (M language) ESIC Challan Extractor logic to Python.

Per-file output (5 fields):
    Month, Year, Total ESIC Contribution Paid, Challan Number, Date of Payment

The Employer/Employee grouping is intentionally NOT done here — it is handled
by pdf_service.py after all files have been parsed.
"""
from __future__ import annotations

import io
import re
from typing import Any

import pdfplumber


# ---------------------------------------------------------------------------
# Month abbreviation → full name (used for financial year logic)
# ---------------------------------------------------------------------------
_APR_TO_DEC = {"APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"}

_MONTH_ABBR_TO_FULL: dict[str, str] = {
    "APR": "Apr", "MAY": "May", "JUN": "Jun",
    "JUL": "Jul", "AUG": "Aug", "SEP": "Sep",
    "OCT": "Oct", "NOV": "Nov", "DEC": "Dec",
    "JAN": "Jan", "FEB": "Feb", "MAR": "Mar",
}


# ---------------------------------------------------------------------------
# Helpers that mirror the M language primitives
# ---------------------------------------------------------------------------

def _flatten_text(file_bytes: bytes) -> str:
    """Replicate M: combine all table-cell text from every PDF page into one
    space-separated string (AllTextStr).

    Strategy mirrors Pdf.Tables + Table.Combine + List.Combine + Text.Combine:
      1. Extract tables from every page via pdfplumber.
      2. Flatten all cell values to trimmed strings, skip blanks.
      3. Join with a single space.

    Falls back to plain page text if no tables are found, which handles PDFs
    where pdfplumber cannot detect table structure.
    """
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        cells: list[str] = []
        has_tables = False

        for page in pdf.pages:
            tables = page.extract_tables()
            if tables:
                has_tables = True
                for table in tables:
                    for row in table:
                        for cell in row:
                            if cell is not None:
                                trimmed = str(cell).strip()
                                if trimmed:
                                    cells.append(trimmed)

        if not has_tables:
            # Fall back to raw page text joined per page
            for page in pdf.pages:
                raw = page.extract_text() or ""
                for line in raw.splitlines():
                    trimmed = line.strip()
                    if trimmed:
                        cells.append(trimmed)

    return " ".join(cells)


def _extract_after_keyword(text: str, keyword: str, offset: int, length: int) -> str:
    """Replicate M: Text.Middle(AllTextStr, Text.PositionOf(...) + offset, length).

    Returns empty string when the keyword is not found.
    """
    idx = text.find(keyword)
    if idx < 0:
        return ""
    start = idx + offset
    return text[start: start + length].strip()


# ---------------------------------------------------------------------------
# Financial Year helper
# ---------------------------------------------------------------------------

def _financial_year(month_val: str, raw_year: int) -> str:
    """Convert (month abbreviation, numeric year) → "YYYY-YY" financial year.

    APR–DEC: FY starts in raw_year  → "raw_year-(raw_year+1 last 2 digits)"
    JAN–MAR: FY started previous year → "(raw_year-1)-raw_year last 2 digits"

    Returns "Unknown" when inputs are invalid.
    """
    if not month_val or raw_year == 0:
        return "Unknown"

    month_upper = month_val.upper()[:3]  # normalise to 3-char abbr
    is_apr_to_dec = month_upper in _APR_TO_DEC

    fy_start = raw_year if is_apr_to_dec else raw_year - 1
    if fy_start <= 0:
        return "Unknown"

    fy_end_yy = str(fy_start + 1)[-2:]
    return f"{fy_start}-{fy_end_yy}"


# ---------------------------------------------------------------------------
# Amount parser
# ---------------------------------------------------------------------------

def _parse_amount(value: str) -> float:
    """Strip commas and convert to float; return 0.0 on failure."""
    try:
        return float(re.sub(r"[,\s]", "", value))
    except (ValueError, AttributeError):
        return 0.0


# ---------------------------------------------------------------------------
# Public parse function
# ---------------------------------------------------------------------------

def parse(file_bytes: bytes) -> list[dict[str, Any]]:
    """Parse a single ESIC challan PDF.

    Returns a list with exactly one dict containing:
        Month, Year, Total ESIC Contribution Paid, Challan Number, Date of Payment

    On hard failure the record is returned with "ERROR" / 0 sentinel values so
    the calling batch loop can still include the file in output.
    """
    try:
        all_text = _flatten_text(file_bytes)

        if not all_text.strip():
            raise ValueError("image_pdf")

        # ── Challan Period ──────────────────────────────────────────────────
        # M: idxPeriod + 15 chars, take 20 → split on space[0] → split on "-"
        period_raw = _extract_after_keyword(all_text, "Challan Period:", 15, 20)
        period_str = period_raw.split(" ")[0] if period_raw else ""

        if "-" in period_str:
            parts = period_str.split("-", 1)
            month_val = parts[0]       # e.g. "Apr"
            try:
                raw_year_val = int(parts[1])
            except ValueError:
                raw_year_val = 0
        else:
            month_val = "Unknown"
            raw_year_val = 0

        # ── Financial Year ──────────────────────────────────────────────────
        financial_year = _financial_year(month_val, raw_year_val)

        # ── Amount Paid ─────────────────────────────────────────────────────
        # M: idxAmount + 12 chars, take 20 → split on space[0]
        amount_raw = _extract_after_keyword(all_text, "Amount Paid:", 12, 20)
        amount_str = amount_raw.split(" ")[0] if amount_raw else "0"
        amount_paid = _parse_amount(amount_str)

        # ── Challan Number ──────────────────────────────────────────────────
        # M: idxChallan + 14 chars, take 30 → strip ":" → split on space[0]
        challan_raw = _extract_after_keyword(all_text, "Challan Number", 14, 30)
        challan_cleaned = challan_raw.replace(":", "").strip()
        challan_num = challan_cleaned.split(" ")[0] if challan_cleaned else "Unknown"

        # ── Date of Payment ─────────────────────────────────────────────────
        # M: idxDate + 22 chars, take 30 → split on space[0]
        date_raw = _extract_after_keyword(all_text, "Challan Submitted Date", 22, 30)
        date_str = date_raw.split(" ")[0] if date_raw else "Unknown"

        return [
            {
                "Month": month_val if month_val else "Unknown",
                "Year": financial_year,
                "Total ESIC Contribution Paid": amount_paid,
                "Challan Number": challan_num if challan_num else "Unknown",
                "Date of Payment": date_str if date_str else "Unknown",
            }
        ]

    except ValueError:
        # Re-raise image_pdf so usage_service can record the right error type
        raise
    except Exception:
        # Return an ERROR sentinel row instead of crashing the batch
        return [
            {
                "Month": "Unknown",
                "Year": "ERROR",
                "Total ESIC Contribution Paid": 0,
                "Challan Number": "ERROR",
                "Date of Payment": "ERROR",
            }
        ]
