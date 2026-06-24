"""PF ECR (Electronic Challan cum Return) PDF parser.

Ports the Power Query M language logic to Python using pdfplumber.
Dual approach: flatten_text for identifiers, extract_tables for numeric values.
"""
from __future__ import annotations

import io
import re
from typing import Any

import pdfplumber


# ---------------------------------------------------------------------------
# BaseParser stub (no separate base module exists in this project yet)
# ---------------------------------------------------------------------------
class BaseParser:
    """Minimal base class so PFECRParser has a consistent interface."""

    def parse(self, file_bytes: bytes) -> list[dict[str, Any]]:
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_str(value: Any) -> str:
    """Safely convert a cell value to a stripped string."""
    if value is None:
        return ""
    try:
        return str(value).strip()
    except Exception:
        return ""


def _to_num(text: str) -> float:
    """Clean and parse a numeric string, returning 0.0 on failure.

    Handles commas, non-breaking spaces, currency symbols, dashes.
    """
    if not isinstance(text, str):
        try:
            return float(text)
        except (TypeError, ValueError):
            return 0.0
    cleaned = text.replace(",", "").replace("\xa0", "").replace("₹", "").strip()
    if cleaned in ("", "-"):
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _get_nums_after_label(row: list[Any], label: str) -> list[float]:
    """Return numeric values in *row* that appear after the cell matching *label*.

    Mirrors the M helper GetNums / G logic.
    """
    texts = [_to_str(c) for c in row]
    label_up = label.upper()
    lbl_idx = next(
        (i for i, t in enumerate(texts) if label_up in t.upper()),
        -1,
    )
    # If label cell not found, try to parse all cells as numbers
    source = texts[lbl_idx + 1:] if lbl_idx >= 0 else texts
    nums: list[float] = []
    for t in source:
        try:
            n = _to_num(t)
            nums.append(n)
        except Exception:
            pass
    # Pad to 10 zeros so index access is always safe
    nums += [0.0] * 10
    return nums


# ---------------------------------------------------------------------------
# Text extraction helpers (mirrors "flatten_text" / AllTextStr in M)
# ---------------------------------------------------------------------------

def _flatten_text(pdf: pdfplumber.PDF) -> str:
    """Combine all page text (and all table cells) into one flat string.

    Replicates the M approach: AllPagesOrTables → AllCellsText → AllTextStr.
    pdfplumber.extract_text() already does page-level extraction; we also
    walk every table cell so embedded table text is included.
    """
    parts: list[str] = []
    for page in pdf.pages:
        page_text = page.extract_text() or ""
        parts.append(page_text)
        # Also flatten table cells so label-based searches work even when
        # the PDF renderer stores text only inside table structures
        for table in (page.extract_tables() or []):
            for row in table:
                for cell in row:
                    s = _to_str(cell)
                    if s:
                        parts.append(s)
    return " ".join(parts)


# ---------------------------------------------------------------------------
# TABLE extraction (mirrors AllRows / FindRows / GetNums / G in M)
# ---------------------------------------------------------------------------

def _extract_all_rows(pdf: pdfplumber.PDF) -> list[list[Any]]:
    """Return every table row from every page, combined into one list."""
    all_rows: list[list[Any]] = []
    for page in pdf.pages:
        for table in (page.extract_tables() or []):
            all_rows.extend(table)
    return all_rows


def _find_rows(all_rows: list[list[Any]], label: str) -> list[list[Any]]:
    """Return rows where any cell contains *label* (case-insensitive)."""
    label_up = label.upper()
    return [
        row for row in all_rows
        if any(label_up in _to_str(cell).upper() for cell in row)
    ]


def _g(all_rows: list[list[Any]], label: str) -> list[float]:
    """Find rows by label, return numeric values after label cell (padded)."""
    rows = _find_rows(all_rows, label)
    if not rows:
        return [0.0] * 10
    return _get_nums_after_label(rows[0], label)


# ---------------------------------------------------------------------------
# Text-based numeric fallback (regex scan on flatten_text)
# ---------------------------------------------------------------------------

_NUM_PAT = re.compile(r"[\d,]+(?:\.\d+)?")


def _nums_from_text_line(text: str) -> list[float]:
    """Extract all numbers from a text segment, padded to 10."""
    nums = [_to_num(m.group()) for m in _NUM_PAT.finditer(text)]
    nums += [0.0] * 10
    return nums


def _fallback_extract(all_text: str, label: str) -> list[float]:
    """Scan flattened text for a line/segment containing *label* and extract numbers."""
    label_up = label.upper()
    # Try line-by-line first
    for line in all_text.splitlines():
        if label_up in line.upper():
            return _nums_from_text_line(line)
    # Try broader segment (50 chars after label occurrence)
    idx = all_text.upper().find(label_up)
    if idx >= 0:
        segment = all_text[idx: idx + 200]
        return _nums_from_text_line(segment)
    return [0.0] * 10


# ---------------------------------------------------------------------------
# Main parser class
# ---------------------------------------------------------------------------

class PFECRParser(BaseParser):
    """Parse a PF ECR combined challan PDF into 15 structured fields.

    Dual approach:
      - flatten_text  → Establishment Code/Name, Month, Year, Challan Date
      - extract_tables → AC01/AC02/AC10/AC21/AC22 numeric values

    Falls back to regex on flattened text when table extraction fails.
    """

    # APR-DEC months belong to the FY that started in that calendar year
    _Q1_TO_Q3_MONTHS = {"APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"}

    # ------------------------------------------------------------------ #
    def parse(self, file_bytes: bytes) -> list[dict[str, Any]]:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            all_text = _flatten_text(pdf)
            all_rows = _extract_all_rows(pdf)

        if not all_text.strip():
            raise ValueError("image_pdf")

        # ── IDENTIFIERS ──────────────────────────────────────────────
        estab_code, estab_name = self._parse_establishment(all_text)
        month_val, raw_year = self._parse_month_year(all_text)
        financial_year = self._calc_financial_year(month_val, raw_year)
        challan_date = self._parse_challan_date(all_text)

        # ── TABLE DATA ───────────────────────────────────────────────
        tables_populated = bool(all_rows)

        r_admin = _g(all_rows, "Administration Charges")
        r_employer = _g(all_rows, "Employer")
        r_employee = _g(all_rows, "Employee")

        # If tables returned zeros across the board, try text fallback
        if not tables_populated or (
            all(v == 0.0 for v in r_admin[:5])
            and all(v == 0.0 for v in r_employer[:4])
            and all(v == 0.0 for v in r_employee[:1])
        ):
            r_admin = _fallback_extract(all_text, "Administration Charges")
            r_employer = _fallback_extract(all_text, "Employer")
            r_employee = _fallback_extract(all_text, "Employee")

        # ── FIELD MAPPING (mirrors M indices) ────────────────────────
        # rAdmin   → index [1] = PF Admin AC02,  index [4] = EDLI Admin AC22
        # rEmployer→ index [0] = EPF AC01,        index [2] = EPS AC10,  index [3] = EDLI AC21
        # rEmployee→ index [0] = Employee EPF AC01
        employer_epf_ac01 = r_employer[0]
        employer_eps_ac10 = r_employer[2]
        employer_edli_ac21 = r_employer[3]
        pf_admin_ac02 = r_admin[1]
        edli_admin_ac22 = r_admin[4]
        employee_epf_ac01 = r_employee[0]

        # ── CALCULATED FIELDS ────────────────────────────────────────
        total_employer = employer_epf_ac01 + employer_eps_ac10 + employer_edli_ac21
        total_admin = pf_admin_ac02 + edli_admin_ac22
        total_employer_incl_admin = total_employer + total_admin
        grand_total = total_employer_incl_admin + employee_epf_ac01

        return [
            {
                "Establishment_Code": estab_code,
                "Establishment_Name": estab_name,
                "Financial_Year": financial_year,
                "Month": month_val,
                "Challan_Date": challan_date,
                "Employer_EPF_AC01": employer_epf_ac01,
                "Employer_EPS_AC10": employer_eps_ac10,
                "Employer_EDLI_AC21": employer_edli_ac21,
                "Total_Employer_Contribution": total_employer,
                "PF_Admin_AC02": pf_admin_ac02,
                "EDLI_Admin_AC22": edli_admin_ac22,
                "Total_Admin_Charges": total_admin,
                "Total_Employer_incl_Admin": total_employer_incl_admin,
                "Employee_EPF_AC01": employee_epf_ac01,
                "Grand_Total": grand_total,
            }
        ]

    # ------------------------------------------------------------------ #
    # Private extraction helpers
    # ------------------------------------------------------------------ #

    def _parse_establishment(self, all_text: str) -> tuple[str, str]:
        """Extract Establishment Code and Name from flattened text.

        Mirrors M logic:
          - Slice between "Establishment Code & Name" (+25 chars) and "Address"
          - First space-token = code, remainder = name
          - Truncate name at "Dues for" if present
        """
        idx_est = all_text.find("Establishment Code & Name")
        idx_addr = all_text.find("Address")

        if idx_est >= 0 and idx_addr > idx_est:
            substr = all_text[idx_est + 25: idx_addr].strip()
        else:
            # Fallback: look for common patterns like "MH/XXX/..." codes
            match = re.search(
                r"\b([A-Z]{2}/[A-Z0-9]+/\S+)\s+(.+?)(?=\s{2,}|Address|\n)",
                all_text,
            )
            if match:
                return match.group(1).strip(), match.group(2).strip()
            return "Unknown", "Unknown"

        if not substr:
            return "Unknown", "Unknown"

        parts = substr.split(" ", 1)
        code = parts[0].strip() if parts else "Unknown"
        name_raw = parts[1].strip() if len(parts) > 1 else "Unknown"

        # Trim name at "Dues for" (artefact when address block bleeds in)
        if "Dues for" in name_raw:
            name_raw = name_raw.split("Dues for")[0].strip()

        return code, name_raw or "Unknown"

    def _parse_month_year(self, all_text: str) -> tuple[str, int]:
        """Extract month name and 4-digit year from wage month phrase.

        Mirrors M logic with FirstDigitIdx to handle "September2022" run-together.
        Returns (month_str, year_int).
        """
        idx_dues = all_text.find("Dues for the wage month of")
        if idx_dues >= 0:
            raw = all_text[idx_dues + 26: idx_dues + 56].strip()
        else:
            # Broader regex fallback
            m = re.search(
                r"(?:wage\s+month|month\s+of)\s+([A-Za-z]+)\s*(\d{4})",
                all_text,
                re.IGNORECASE,
            )
            if m:
                return m.group(1).strip(), int(m.group(2))
            return "Unknown", 0

        # Find first digit in the extracted substring
        first_digit = next((i for i, c in enumerate(raw) if c.isdigit()), -1)

        if first_digit > 0:
            month_val = raw[:first_digit].strip()
            year_str = re.sub(r"\D", "", raw[first_digit:])[:4]
            raw_year = int(year_str) if year_str.isdigit() else 0
        elif first_digit == 0:
            # Starts with digit — split on space
            tokens = raw.split()
            month_val = tokens[0] if tokens else "Unknown"
            year_str = tokens[1] if len(tokens) > 1 else "0"
            raw_year = int(year_str) if year_str.isdigit() else 0
        else:
            # No digit found at all
            tokens = raw.split()
            month_val = tokens[0] if tokens else "Unknown"
            raw_year = 0

        return month_val or "Unknown", raw_year

    def _calc_financial_year(self, month_val: str, raw_year: int) -> str:
        """Derive FY string (e.g. "2022-23") from month name and calendar year.

        APR-DEC → FY starts in raw_year (e.g. Apr 2022 → 2022-23)
        JAN-MAR → FY started the previous year (e.g. Jan 2023 → 2022-23)
        """
        if raw_year == 0:
            return "Unknown"
        month_up = month_val.upper()
        is_q1_to_q3 = any(m in month_up for m in self._Q1_TO_Q3_MONTHS)
        fy_start = raw_year if is_q1_to_q3 else raw_year - 1
        fy_end_yy = str(fy_start + 1)[-2:]
        return f"{fy_start}-{fy_end_yy}"

    def _parse_challan_date(self, all_text: str) -> str:
        """Extract challan generation date.

        Mirrors M logic: after "system generated challan on " (+28 chars),
        take the first space-delimited token.
        """
        marker = "system generated challan on "
        idx = all_text.lower().find(marker)
        if idx >= 0:
            snippet = all_text[idx + len(marker): idx + len(marker) + 20].strip()
            return snippet.split()[0] if snippet.split() else "Unknown"

        # Regex fallback for various date formats
        m = re.search(
            r"(?:generated\s+on|challan\s+date)[:\s]+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
            all_text,
            re.IGNORECASE,
        )
        return m.group(1) if m else "Unknown"


# ---------------------------------------------------------------------------
# Module-level parse() function — keeps the existing registry call working
# ---------------------------------------------------------------------------

def parse(file_bytes: bytes) -> list[dict[str, Any]]:
    """Parse a PF ECR challan PDF.  Entry point used by the parser registry."""
    return PFECRParser().parse(file_bytes)
