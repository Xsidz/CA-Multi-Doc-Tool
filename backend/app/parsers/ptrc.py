"""PTRC (Maharashtra Profession Tax Return Cum Challan) PDF parser.

Ports the Power Query / M-language logic exactly:
- Flattens all PDF pages to a single string.
- Extracts fields using positional substring logic mirroring the M script.
- Sorts output rows chronologically by PTRC return month.
"""
from __future__ import annotations

import io
import re
from typing import Any

import pdfplumber
from dateutil import parser as dateutil_parser
from dateutil.relativedelta import relativedelta


# ---------------------------------------------------------------------------
# Module-level entry point (keeps registry.py working without changes)
# ---------------------------------------------------------------------------

def parse(file_bytes: bytes) -> list[dict[str, Any]]:
    """Parse a PTRC challan PDF and return structured rows."""
    return PTRCParser.parse(file_bytes)


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _between(text: str, start_label: str, end_label: str) -> str:
    """Return the substring of *text* found between *start_label* and *end_label*.

    Returns an empty string when either marker is missing.
    """
    start_idx = text.find(start_label)
    if start_idx == -1:
        return ""
    start_idx += len(start_label)
    end_idx = text.find(end_label, start_idx)
    if end_idx == -1:
        return ""
    return text[start_idx:end_idx]


def _after(text: str, label: str, offset: int) -> str:
    """Return text starting at *label* position + len(label) + *offset*."""
    idx = text.find(label)
    if idx == -1:
        return ""
    return text[idx + len(label) + offset:]


def _first_token(text: str) -> str:
    """Return the first whitespace-delimited token from *text*."""
    stripped = text.strip()
    if not stripped:
        return ""
    return stripped.split()[0]


def _clean_number(value: str) -> float:
    """Strip commas/spaces and convert to float; return 0.0 on failure."""
    try:
        return float(value.replace(",", "").replace(" ", "").strip())
    except (ValueError, AttributeError):
        return 0.0


# ---------------------------------------------------------------------------
# Main parser class
# ---------------------------------------------------------------------------

class PTRCParser:
    """Maharashtra PTRC challan PDF parser.

    Usage
    -----
    rows = PTRCParser.parse(file_bytes)
    """

    OUTPUT_FIELDS = [
        "Type of Return",
        "TAN",
        "Company Name",
        "PTRC return for the month",
        "Date of filing",
        "Year",
        "Month",
        "PT Paid",
        "Challan No.",
    ]

    # TAN label variants with their respective character offsets (as in M script)
    _TAN_VARIANTS: list[tuple[str, int]] = [
        ("TAX ID/TAN (If Any)", 19),
        ("TAX ID / TAN (If Any)", 21),
        ("TAN (If Any)", 12),
    ]

    # Guard values that indicate the TAN extraction landed on the wrong field
    _TAN_GUARD_VALUES = {"PAN", "Type", "Full"}

    @classmethod
    def parse(cls, file_bytes: bytes) -> list[dict[str, Any]]:
        """Parse *file_bytes* (a PTRC PDF) and return a list of row dicts.

        Each row contains the keys listed in ``OUTPUT_FIELDS``.
        The list is sorted chronologically by the PTRC return month.
        """
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            # Flatten all pages to a single string (mirrors M: Text.Combine)
            full_text = " ".join(
                (page.extract_text() or "").replace("\n", " ")
                for page in pdf.pages
            )

        if not full_text.strip():
            raise ValueError("image_pdf")

        row = cls._extract_row(full_text)
        rows = [row]

        # Sort chronologically by PTRC return month
        rows.sort(key=cls._sort_key)
        return rows

    # ------------------------------------------------------------------
    # Field extraction — mirrors M script logic 1-to-1
    # ------------------------------------------------------------------

    @classmethod
    def _extract_row(cls, text: str) -> dict[str, Any]:
        type_of_return = cls._extract_type_of_return(text)
        tan = cls._extract_tan(text)
        company_name = cls._extract_company_name(text)
        filing_date = cls._extract_filing_date(text)
        year = cls._extract_year(text)
        month, ptrc_return_month = cls._extract_month_fields(text)
        pt_paid = cls._extract_pt_paid(text)
        challan_no = cls._extract_challan_no(text)

        return {
            "Type of Return": type_of_return,
            "TAN": tan,
            "Company Name": company_name,
            "PTRC return for the month": ptrc_return_month,
            "Date of filing": filing_date,
            "Year": year,
            "Month": month,
            "PT Paid": pt_paid,
            "Challan No.": challan_no,
        }

    @classmethod
    def _extract_type_of_return(cls, text: str) -> str:
        """Between "Type of Payment" and "Office Name"."""
        return _between(text, "Type of Payment", "Office Name").strip()

    @classmethod
    def _extract_tan(cls, text: str) -> str:
        """Try three label variants; guard against landing on wrong field."""
        for label, offset in cls._TAN_VARIANTS:
            if label in text:
                raw = _after(text, label, offset)
                token = _first_token(raw)
                if token in cls._TAN_GUARD_VALUES:
                    return ""
                return token
        return ""

    @classmethod
    def _extract_company_name(cls, text: str) -> str:
        """Part1: between "Full Name" and "Location".
        Part2: between "Remarks (If Any)" and "Amount In" — only when gap < 150 chars.
        Concatenate both parts.
        """
        part1 = _between(text, "Full Name", "Location").strip()

        raw_part2 = _between(text, "Remarks (If Any)", "Amount In")
        part2 = raw_part2.strip() if len(raw_part2) < 150 else ""

        return (part1 + " " + part2).strip()

    @classmethod
    def _extract_filing_date(cls, text: str) -> str:
        """After "Date " (5 chars offset), take the next 10 characters."""
        raw = _after(text, "Date ", 5)
        return raw[:10].strip() if raw else ""

    @classmethod
    def _extract_year(cls, text: str) -> str:
        """After "Year" (4 chars offset), first space-delimited token."""
        raw = _after(text, "Year", 4)
        return _first_token(raw)

    @classmethod
    def _extract_month_fields(cls, text: str) -> tuple[str, str]:
        """Parse the "From " date (dd/MM/yyyy) to derive:
        - Month (payment month): "MMMM yyyy" e.g. "January 2024"
        - PTRC return month: From date minus 1 month → "MMM yyyy" e.g. "Dec 2023"

        Returns (month_str, ptrc_return_month_str).
        Falls back to ("Unknown", "Unknown") on parse failure.
        """
        from_raw = _after(text, "From ", 0)
        date_token = _first_token(from_raw)

        try:
            from_date = dateutil_parser.parse(date_token, dayfirst=True)
            month_str = from_date.strftime("%B %Y")           # "January 2024"
            ptrc_date = from_date - relativedelta(months=1)
            ptrc_return_month = ptrc_date.strftime("%b %Y")   # "Dec 2023"
            return month_str, ptrc_return_month
        except (ValueError, OverflowError, TypeError):
            return "Unknown", "Unknown"

    @classmethod
    def _extract_pt_paid(cls, text: str) -> float:
        """After "AMOUNT OF TAX" (13 chars offset), clean_number of first token."""
        raw = _after(text, "AMOUNT OF TAX", 13)
        token = _first_token(raw)
        return _clean_number(token)

    @classmethod
    def _extract_challan_no(cls, text: str) -> str:
        """After "Ref. No." (8 chars offset), first space-delimited token."""
        raw = _after(text, "Ref. No.", 8)
        return _first_token(raw)

    # ------------------------------------------------------------------
    # Sort key
    # ------------------------------------------------------------------

    @staticmethod
    def _sort_key(row: dict[str, Any]) -> tuple:
        """Sort chronologically by 'PTRC return for the month'.

        Rows with unparseable / "Unknown" months sort to the end.
        """
        month_str = row.get("PTRC return for the month", "Unknown")
        if month_str == "Unknown":
            return (9999, 99)
        try:
            dt = dateutil_parser.parse(month_str)
            return (dt.year, dt.month)
        except (ValueError, TypeError):
            return (9999, 99)
