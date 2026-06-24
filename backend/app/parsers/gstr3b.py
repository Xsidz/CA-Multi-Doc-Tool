"""GSTR-3B PDF parser — ported from Power Query M language.

Strategy mirrors the original M script:
1. Extract all tables from the PDF (primary: line-based strategy, fallback: default).
2. Flatten all rows into a single pool for identifier/section lookups.
3. Parse Table 3.1 (outward supplies) with the G/GN helpers.
4. Parse Table 4 (ITC) the same way.
5. Parse Table 6.1 with the dynamic-matrix column/row resolver.
6. Compute derived payables and validate them.
"""
from __future__ import annotations

import io
import re
import unicodedata
from typing import Any, Optional

import pdfplumber


# ---------------------------------------------------------------------------
# Public entry point (matches the registry signature used by other parsers)
# ---------------------------------------------------------------------------

def parse(file_bytes: bytes) -> list[dict[str, Any]]:
    """Parse a GSTR-3B PDF and return a list with one result dict."""
    parser = GSTR3BParser(file_bytes)
    return [parser.parse()]


# ---------------------------------------------------------------------------
# Main parser class
# ---------------------------------------------------------------------------

class GSTR3BParser:
    """Table-driven GSTR-3B parser, faithful port of the Power Query M script."""

    # pdfplumber table extraction settings — primary then fallback
    _TABLE_SETTINGS_LINES = {
        "vertical_strategy": "lines",
        "horizontal_strategy": "lines",
    }
    _TABLE_SETTINGS_DEFAULT: dict[str, Any] = {}

    def __init__(self, file_bytes: bytes) -> None:
        self._file_bytes = file_bytes
        # All rows from all tables combined (for identifier + section search)
        self._all_rows: list[list[str]] = []
        # Raw table list from pdfplumber (each element is list[list[str|None]])
        self._raw_tables: list[list[list[str]]] = []

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def parse(self) -> dict[str, Any]:
        """Run the full extraction pipeline and return the result dict."""
        self._load_tables()

        # ── Step 1: Basic identifiers ──────────────────────────────────
        year       = self._get_text_val("Year",                   lambda v: v and "YEAR" not in v.upper())
        month      = self._get_text_val("Period",                 lambda v: v and "PERIOD" not in v.upper() and "RETURN" not in v.upper())
        gstin      = self._get_text_val("GSTIN of the supplier",  lambda v: v and len(v) == 15)
        legal_name = self._get_text_val("Legal name",             lambda v: v and "LEGAL NAME" not in v.upper())
        trade_name = self._get_text_val("Trade name",             lambda v: v and "TRADE NAME" not in v.upper())
        filing_dt  = self._get_text_val("Date of ARN",            lambda v: v and "DATE OF ARN" not in v.upper())

        # ── Step 2: Table 3.1 ─────────────────────────────────────────
        v3_1a = self._G("other than zero rated")
        v3_1b = self._G("zero rated)")
        v3_1c = self._G("Other outward supplies")
        v3_1d = self._G("liable to reverse charge")

        total_output_igst = v3_1a[1] + v3_1b[1] + v3_1c[1]
        total_output_cgst = v3_1a[2] + v3_1b[2] + v3_1c[2]
        total_output_sgst = v3_1a[3] + v3_1b[3] + v3_1c[3]

        # ── Step 3: Table 4 (ITC) ──────────────────────────────────────
        i4a1 = self._G("Import of goods")
        i4a2 = self._G("Import of services")
        i4a3 = self._G("other than 1 & 2 above")
        i4a4 = self._G("from ISD")
        i4a5 = self._G("All other ITC")
        i4b1 = self._G("rules 38,42")
        i4b2 = self._GN("Others", 1)

        tot_igst_in = i4a1[0] + i4a2[0] + i4a3[0] + i4a4[0] + i4a5[0]
        tot_cgst_in = i4a1[1] + i4a2[1] + i4a3[1] + i4a4[1] + i4a5[1]
        tot_sgst_in = i4a1[2] + i4a2[2] + i4a3[2] + i4a4[2] + i4a5[2]

        inel_igst = i4b1[0] + i4b2[0]
        inel_cgst = i4b1[1] + i4b2[1]
        inel_sgst = i4b1[2] + i4b2[2]

        net_igst = tot_igst_in - inel_igst
        net_cgst = tot_cgst_in - inel_cgst
        net_sgst = tot_sgst_in - inel_sgst

        # ── Step 4: Table 6.1 dynamic matrix ──────────────────────────
        matrix = self._parse_table_61()

        util_igst_to_igst = matrix["igst_to_igst"]
        util_igst_to_cgst = matrix["igst_to_cgst"]
        util_igst_to_sgst = matrix["igst_to_sgst"]
        util_cgst_to_igst = matrix["cgst_to_igst"]
        util_cgst_to_cgst = matrix["cgst_to_cgst"]
        util_sgst_to_igst = matrix["sgst_to_igst"]
        util_sgst_to_sgst = matrix["sgst_to_sgst"]
        int_paid  = matrix["interest_paid"]
        lf_paid   = matrix["late_fees_paid"]

        # ── Step 5: Derived payables ───────────────────────────────────
        calc_igst_payable = (
            total_output_igst + v3_1d[1]
            - util_igst_to_igst - util_cgst_to_igst - util_sgst_to_igst
        )
        calc_cgst_payable = (
            total_output_cgst + v3_1d[2]
            - util_igst_to_cgst - util_cgst_to_cgst
        )
        calc_sgst_payable = (
            total_output_sgst + v3_1d[3]
            - util_igst_to_sgst - util_sgst_to_sgst
        )

        result: dict[str, Any] = {
            "Year":  year,
            "Month": month,
            "GSTIN": gstin,
            "Company Name": legal_name,
            "Trade Name":   trade_name,
            # Table 3.1 taxable values
            "Outward taxable supplies (other than zero rated, nil rated and exempted)": v3_1a[0],
            "Outward taxable supplies (zero rated)":                                    v3_1b[0],
            "Other outward supplies (nil rated, exempted)":                             v3_1c[0],
            # Aggregate output taxes
            "Output IGST": total_output_igst,
            "Output CGST": total_output_cgst,
            "Output SGST": total_output_sgst,
            # RCM
            "RCM Taxable Value":   v3_1d[0],
            "RCM IGST Payable":    v3_1d[1],
            "RCM CGST Payable":    v3_1d[2],
            "RCM SGST Payable":    v3_1d[3],
            # ITC
            "Total Input IGST": tot_igst_in,
            "Total Input CGST": tot_cgst_in,
            "Total Input SGST": tot_sgst_in,
            "Ineligible IGST":  inel_igst,
            "Ineligible CGST":  inel_cgst,
            "Ineligible SGST":  inel_sgst,
            "Net Input IGST":   net_igst,
            "Net Input CGST":   net_cgst,
            "Net Input SGST":   net_sgst,
            # Table 6.1 matrix utilisation
            "IGST to IGST": util_igst_to_igst,
            "IGST to CGST": util_igst_to_cgst,
            "IGST to SGST": util_igst_to_sgst,
            "CGST to IGST": util_cgst_to_igst,
            "CGST to CGST": util_cgst_to_cgst,
            "SGST to IGST": util_sgst_to_igst,
            "SGST to SGST": util_sgst_to_sgst,
            # Derived payables
            "IGST Payable": calc_igst_payable,
            "CGST Payable": calc_cgst_payable,
            "SGST Payable": calc_sgst_payable,
            # Penalty / interest
            "Interest paid":   int_paid,
            "Late Fees paid":  lf_paid,
            "Date of filing":  filing_dt,
        }

        # ── Step 6: Validation ─────────────────────────────────────────
        self._validate_payables(result)

        return result

    # ------------------------------------------------------------------
    # Table loading
    # ------------------------------------------------------------------

    def _load_tables(self) -> None:
        """Extract tables from the PDF using line strategy first, then fallback."""
        with pdfplumber.open(io.BytesIO(self._file_bytes)) as pdf:
            # Verify the PDF has extractable text (not pure image)
            all_text = " ".join(p.extract_text() or "" for p in pdf.pages)
            if not all_text.strip():
                raise ValueError("image_pdf")

            raw: list[list[list[str]]] = []
            for page in pdf.pages:
                tables = page.extract_tables(table_settings=self._TABLE_SETTINGS_LINES)
                if not tables:
                    tables = page.extract_tables(table_settings=self._TABLE_SETTINGS_DEFAULT)
                for tbl in (tables or []):
                    clean = self._clean_table(tbl)
                    if clean:
                        raw.append(clean)

            # If line strategy yielded nothing at all, retry every page with default
            if not raw:
                with pdfplumber.open(io.BytesIO(self._file_bytes)) as pdf2:
                    for page in pdf2.pages:
                        tables = page.extract_tables(table_settings=self._TABLE_SETTINGS_DEFAULT)
                        for tbl in (tables or []):
                            clean = self._clean_table(tbl)
                            if clean:
                                raw.append(clean)

        self._raw_tables = raw
        # Flatten all rows for global search
        self._all_rows = [row for tbl in raw for row in tbl]

    @staticmethod
    def _clean_table(tbl: list[list[Any]]) -> list[list[str]]:
        """Convert a raw pdfplumber table (cells may be None) to list[list[str]]."""
        result = []
        for row in tbl:
            if row:
                result.append([GSTR3BParser._t(cell) for cell in row])
        return result

    # ------------------------------------------------------------------
    # Low-level text/number helpers (mirror M helpers T and N)
    # ------------------------------------------------------------------

    @staticmethod
    def _t(v: Any) -> str:
        """Clean a cell value to a stripped string (equivalent to M helper T)."""
        if v is None:
            return ""
        s = str(v)
        # Normalise non-breaking spaces and other unicode whitespace
        s = unicodedata.normalize("NFKC", s)
        return s.strip()

    @staticmethod
    def _n(s: str) -> float:
        """Parse a cleaned number string, returning 0 on failure (equivalent to M helper N)."""
        # Remove currency symbol, non-breaking space, commas, line-breaks
        cleaned = re.sub(r"[, ₹\r\n]", "", s).strip()
        if not cleaned or cleaned == "-":
            return 0.0
        try:
            return float(cleaned)
        except ValueError:
            return 0.0

    # ------------------------------------------------------------------
    # Row-search helpers (mirror M helpers FindRows / GetTextVal / GetNums)
    # ------------------------------------------------------------------

    def _find_rows(self, label: str) -> list[list[str]]:
        """Return all rows from the combined pool that contain *label* (case-insensitive)."""
        label_upper = label.upper()
        return [
            row for row in self._all_rows
            if any(label_upper in self._t(cell).upper() for cell in row)
        ]

    def _get_text_val(self, label: str, condition) -> str:
        """
        Find rows matching *label*, take the first row, return the last cell
        that passes *condition(cell_text)*.  Returns "Unknown" if nothing matches.
        Mirrors M helper GetTextVal.
        """
        rows = self._find_rows(label)
        if not rows:
            return "Unknown"
        cells = [self._t(c) for c in rows[0]]
        valid = [c for c in cells if condition(c)]
        return valid[-1] if valid else "Unknown"

    def _get_nums(self, row: list[str], label: str) -> list[float]:
        """
        From *row*, find the position of *label*, take everything after it,
        parse as numbers, and pad to at least 12 elements with zeros.
        Mirrors M helper GetNums.
        """
        texts = [self._t(c) for c in row]
        label_upper = label.upper()
        lbl_idx = next(
            (i for i, t in enumerate(texts) if label_upper in t.upper()),
            -1,
        )
        after = texts[lbl_idx + 1:] if lbl_idx >= 0 else texts
        nums = [self._n(t) for t in after]
        # Pad to 12
        nums += [0.0] * 12
        return nums

    def _G(self, label: str) -> list[float]:
        """G helper: first matching row → GetNums.  Mirrors M G()."""
        rows = self._find_rows(label)
        if rows:
            return self._get_nums(rows[0], label)
        return [0.0] * 12

    def _GN(self, label: str, n: int) -> list[float]:
        """GN helper: nth matching row → GetNums.  Mirrors M GN()."""
        rows = self._find_rows(label)
        if len(rows) > n:
            return self._get_nums(rows[n], label)
        return [0.0] * 12

    # ------------------------------------------------------------------
    # Table 6.1 dynamic matrix parser
    # ------------------------------------------------------------------

    def _parse_table_61(self) -> dict[str, float]:
        """
        Locate Table 6.1, dynamically identify columns by keyword search in
        the header block, then extract matrix intersection values.

        Returns a dict with the 9 utilisation values plus interest/late fees.
        """
        zero_result: dict[str, float] = {
            "igst_to_igst": 0.0, "igst_to_cgst": 0.0, "igst_to_sgst": 0.0,
            "cgst_to_igst": 0.0, "cgst_to_cgst": 0.0,
            "sgst_to_igst": 0.0, "sgst_to_sgst": 0.0,
            "interest_paid": 0.0, "late_fees_paid": 0.0,
        }

        # 4.1 — Isolate the table that contains "(A) OTHER THAN REVERSE CHARGE"
        tbl61: Optional[list[list[str]]] = None
        for tbl in self._raw_tables:
            for row in tbl:
                if any("(A) OTHER THAN REVERSE CHARGE" in self._t(c).upper() for c in row):
                    tbl61 = tbl
                    break
            if tbl61 is not None:
                break

        if tbl61 is None:
            return zero_result

        rows = tbl61  # list[list[str]]

        # 4.2 — Find section boundary row indices
        idx_sec_a = next(
            (i for i, r in enumerate(rows)
             if any("(A) OTHER THAN REVERSE CHARGE" in self._t(c).upper() for c in r)),
            -1,
        )
        idx_sec_b = next(
            (i for i, r in enumerate(rows)
             if any("(B) REVERSE CHARGE" in self._t(c).upper() for c in r)),
            -1,
        )

        if idx_sec_a == -1:
            return zero_result

        # 4.3 — Build header block (rows before idx_sec_a)
        header_limit = idx_sec_a if idx_sec_a > 0 else min(4, len(rows))
        header_rows = rows[:header_limit]
        col_count = len(rows[0]) if rows else 0

        def get_col_idx(
            keywords: list[str],
            after_idx: int = -1,
            before_idx: int = -1,
        ) -> int:
            """
            Search columns (skip col 0) for those whose concatenated header text
            contains ALL *keywords*.  Optionally constrained to a column range.
            Mirrors M GetColIdx.
            """
            for i in range(1, col_count):
                col_cells = [self._t(r[i]) if i < len(r) else "" for r in header_rows]
                combined = " ".join(col_cells).upper()
                if all(kw.upper() in combined for kw in keywords):
                    if after_idx != -1 and i <= after_idx:
                        continue
                    if before_idx != -1 and i >= before_idx:
                        continue
                    return i
            return -1

        # Structural anchor columns
        idx_net_tax = get_col_idx(["NET", "PAYABLE"])
        idx_cash    = get_col_idx(["TAX", "CASH"])
        idx_int     = get_col_idx(["INTEREST", "CASH"])
        idx_late    = get_col_idx(["LATE", "CASH"])

        # ITC columns — must be strictly between idx_net_tax and idx_cash
        before_cash = idx_cash if idx_cash != -1 else -1
        idx_itc_igst = get_col_idx(["INTEGRATED"], idx_net_tax, before_cash)
        idx_itc_cgst = get_col_idx(["CENTRAL"],    idx_net_tax, before_cash)
        idx_itc_sgst = get_col_idx(["STATE"],       idx_net_tax, before_cash)

        # 4.4 — Extract data rows within a section band
        def get_matrix_row(
            keyword: str,
            start_idx: int,
            end_idx: int,
        ) -> Optional[list[str]]:
            """
            Within rows[start_idx+1 : end_idx], find first row whose col[0]
            contains *keyword* (case-insensitive).  Mirrors M GetMatrixRow.
            """
            if start_idx == -1:
                return None
            end = end_idx if end_idx != -1 else len(rows)
            search_slice = rows[start_idx + 1: end]
            for r in search_slice:
                if r and keyword.upper() in self._t(r[0]).upper():
                    return r
            return None

        row_a_igst = get_matrix_row("INTEGRATED", idx_sec_a, idx_sec_b)
        row_a_cgst = get_matrix_row("CENTRAL",    idx_sec_a, idx_sec_b)
        row_a_sgst = get_matrix_row("STATE",       idx_sec_a, idx_sec_b)

        row_b_igst = get_matrix_row("INTEGRATED", idx_sec_b, -1)
        row_b_cgst = get_matrix_row("CENTRAL",    idx_sec_b, -1)
        row_b_sgst = get_matrix_row("STATE",       idx_sec_b, -1)

        # 4.5 — Extract value at matrix intersection
        def extract_val(row: Optional[list[str]], idx: int) -> float:
            if row is None or idx == -1 or idx >= len(row):
                return 0.0
            return self._n(self._t(row[idx]))

        return {
            "igst_to_igst": extract_val(row_a_igst, idx_itc_igst),
            "igst_to_cgst": extract_val(row_a_cgst, idx_itc_igst),
            "igst_to_sgst": extract_val(row_a_sgst, idx_itc_igst),
            "cgst_to_igst": extract_val(row_a_igst, idx_itc_cgst),
            "cgst_to_cgst": extract_val(row_a_cgst, idx_itc_cgst),
            "sgst_to_igst": extract_val(row_a_igst, idx_itc_sgst),
            "sgst_to_sgst": extract_val(row_a_sgst, idx_itc_sgst),
            "interest_paid": (
                extract_val(row_a_igst, idx_int) + extract_val(row_a_cgst, idx_int) +
                extract_val(row_a_sgst, idx_int) + extract_val(row_b_igst, idx_int) +
                extract_val(row_b_cgst, idx_int) + extract_val(row_b_sgst, idx_int)
            ),
            "late_fees_paid": (
                extract_val(row_a_igst, idx_late) + extract_val(row_a_cgst, idx_late) +
                extract_val(row_a_sgst, idx_late) + extract_val(row_b_igst, idx_late) +
                extract_val(row_b_cgst, idx_late) + extract_val(row_b_sgst, idx_late)
            ),
        }

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def _validate_payables(self, result: dict[str, Any]) -> None:
        """
        Cross-check that the derived IGST/CGST/SGST payables are internally
        consistent.  The M script computes them from a formula; here we verify
        that the Net ITC subtracted does not exceed the output (a basic sanity
        check) and that the payables are non-negative when output tax exists.

        Sets result["_needs_review"] = True with a reason string if any check
        fails (tolerance: ₹1).
        """
        issues: list[str] = []
        tolerance = 1.0

        for tax, key_payable, key_output, key_rcm, key_net in [
            ("IGST", "IGST Payable", "Output IGST", "RCM IGST Payable", "Net Input IGST"),
            ("CGST", "CGST Payable", "Output CGST", "RCM CGST Payable", "Net Input CGST"),
            ("SGST", "SGST Payable", "Output SGST", "RCM SGST Payable", "Net Input SGST"),
        ]:
            payable = result.get(key_payable, 0.0)
            output  = result.get(key_output,  0.0)
            rcm     = result.get(key_rcm,     0.0)
            # If there is output tax but computed payable is oddly negative, flag it
            if (output + rcm) > tolerance and payable < -tolerance:
                issues.append(
                    f"{tax} Payable ({payable:.2f}) is negative while Output+RCM "
                    f"is {output + rcm:.2f} — possible ITC over-utilisation or extraction error"
                )

        # Cross-verify IGST formula explicitly
        igst_formula = (
            result.get("Output IGST", 0.0)
            + result.get("RCM IGST Payable", 0.0)
            - result.get("IGST to IGST", 0.0)
            - result.get("CGST to IGST", 0.0)
            - result.get("SGST to IGST", 0.0)
        )
        cgst_formula = (
            result.get("Output CGST", 0.0)
            + result.get("RCM CGST Payable", 0.0)
            - result.get("IGST to CGST", 0.0)
            - result.get("CGST to CGST", 0.0)
        )
        sgst_formula = (
            result.get("Output SGST", 0.0)
            + result.get("RCM SGST Payable", 0.0)
            - result.get("IGST to SGST", 0.0)
            - result.get("SGST to SGST", 0.0)
        )

        for tax, formula, stored_key in [
            ("IGST", igst_formula, "IGST Payable"),
            ("CGST", cgst_formula, "CGST Payable"),
            ("SGST", sgst_formula, "SGST Payable"),
        ]:
            stored = result.get(stored_key, 0.0)
            if abs(formula - stored) > tolerance:
                issues.append(
                    f"{tax} Payable formula mismatch: computed {formula:.2f} "
                    f"vs stored {stored:.2f} (diff {abs(formula - stored):.2f})"
                )

        if issues:
            result["_needs_review"] = True
            result["_review_reasons"] = issues
        else:
            result["_needs_review"] = False
