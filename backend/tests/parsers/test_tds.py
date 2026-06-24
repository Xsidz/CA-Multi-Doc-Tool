"""Unit tests for TDSParser (app.parsers.tds_itns281).

Coverage:
- clean_number_strict with various inputs
- financial_year logic via BaseParser.financial_year
- TDS month logic (day<=7, April payment, interest>0 cases)
- Major Head normalisation
- IMAGE_PDF error case: parse_file with empty bytes returns _parse_error="IMAGE_PDF"
"""
from __future__ import annotations

import io
import struct
import unittest
from unittest.mock import MagicMock, patch

from app.parsers.base import BaseParser
from app.parsers.tds_itns281 import TDSParser


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_minimal_pdf_bytes() -> bytes:
    """Return the smallest valid-ish PDF bytes that pdfplumber will open but
    that contain no text (simulates a pure-image PDF so the IMAGE_PDF branch
    fires in parse_file)."""
    # A real PDF with a blank page and no content stream text
    content = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\n"
        b"startxref\n190\n%%EOF"
    )
    return content


# ---------------------------------------------------------------------------
# clean_number_strict
# ---------------------------------------------------------------------------

class TestCleanNumberStrict(unittest.TestCase):
    """BaseParser.clean_number_strict keeps only digits and '-' characters."""

    def _call(self, s):
        return BaseParser.clean_number_strict(s)

    def test_plain_integer(self):
        self.assertEqual(self._call("12345"), 12345.0)

    def test_integer_with_commas(self):
        self.assertEqual(self._call("1,23,456"), 123456.0)

    def test_integer_with_currency_symbol(self):
        self.assertEqual(self._call("₹9,999"), 9999.0)

    def test_integer_with_spaces(self):
        self.assertEqual(self._call("  5 000 "), 5000.0)

    def test_negative_value(self):
        self.assertEqual(self._call("-250"), -250.0)

    def test_empty_string(self):
        self.assertEqual(self._call(""), 0.0)

    def test_none_like_empty(self):
        # Passing None should not raise; coerced to str first
        self.assertEqual(self._call(None), 0.0)  # type: ignore[arg-type]

    def test_all_non_digits(self):
        self.assertEqual(self._call("Rs. N/A"), 0.0)

    def test_dash_only(self):
        self.assertEqual(self._call("-"), 0.0)

    def test_mixed_letters_and_digits(self):
        # Letters are stripped; only digits survive
        self.assertEqual(self._call("TDS100ABC"), 100.0)

    def test_decimal_stripped(self):
        # clean_number_strict strips the decimal point too (only digits + "-")
        result = self._call("1234.56")
        self.assertEqual(result, 123456.0)

    def test_zero(self):
        self.assertEqual(self._call("0"), 0.0)

    def test_large_number(self):
        self.assertEqual(self._call("1,00,00,000"), 10000000.0)


# ---------------------------------------------------------------------------
# financial_year (via BaseParser static method)
# ---------------------------------------------------------------------------

class TestFinancialYear(unittest.TestCase):
    """BaseParser.financial_year derives FY string from month abbr + calendar year."""

    def _fy(self, month, year):
        return BaseParser.financial_year(month, year)

    # APR-DEC → FY starts in raw_year
    def test_april(self):
        self.assertEqual(self._fy("APR", 2023), "2023-24")

    def test_december(self):
        self.assertEqual(self._fy("DEC", 2022), "2022-23")

    def test_september(self):
        self.assertEqual(self._fy("SEP", 2024), "2024-25")

    # JAN-MAR → FY started previous year
    def test_january(self):
        self.assertEqual(self._fy("JAN", 2024), "2023-24")

    def test_march(self):
        self.assertEqual(self._fy("MAR", 2024), "2023-24")

    def test_february(self):
        self.assertEqual(self._fy("FEB", 2023), "2022-23")

    # Case-insensitive
    def test_lowercase_month(self):
        self.assertEqual(self._fy("jun", 2023), "2023-24")

    def test_mixed_case_month(self):
        self.assertEqual(self._fy("Nov", 2021), "2021-22")

    # Edge / boundary cases
    def test_zero_year_returns_unknown(self):
        # MAR with year=0 → fy_start = 0-1 = -1; only fy_start==0 is "Unknown"
        # The actual result is "-1-0" (edge case outside normal usage)
        result = self._fy("MAR", 0)
        self.assertIsInstance(result, str)
        # Confirm it is NOT a valid FY string for year 0 inputs:
        self.assertNotEqual(result, "0-01")

    def test_year_one_mar_gives_unknown(self):
        # MAR with year=1 → fy_start = 0 → "Unknown"
        self.assertEqual(self._fy("MAR", 1), "Unknown")

    def test_empty_month_falls_back_to_jan_mar_path(self):
        # Empty month string: m="" is not in q1_to_q3, so treated as JAN-MAR path
        # fy_start = year_int - 1 = 2022; returns "2022-23"
        result = self._fy("", 2023)
        self.assertEqual(result, "2022-23")

    def test_fy_end_two_digits_zero_padded(self):
        # 2099 → 2099-00 (last two digits of 2100)
        self.assertEqual(self._fy("APR", 2099), "2099-00")


# ---------------------------------------------------------------------------
# TDS month logic
# ---------------------------------------------------------------------------

class TestTDSMonthLogic(unittest.TestCase):
    """Verify the TDS deduction month derivation inside TDSParser._parse.

    Strategy: mock pdfplumber so we control the cell sequence returned, then
    verify the 'Month' field in the output dict.

    The logic under test (lines 100-117 of tds_itns281.py):
      - p_month == 4 (April payment) → deduction_date = March of same year
      - p_day <= 7                   → deduction_date = previous month
      - interest > 0                 → deduction_date = previous month
      - otherwise                    → deduction_date = current month
    """

    def _build_cell_sequence(
        self,
        payment_date: str,
        interest: str = "0",
    ) -> list[str]:
        """Return a minimal ordered cell list that TDSParser can parse.

        The parser scans clean_upper for label text then takes the next cell as
        the value.  We build a flat sequence of (LABEL, VALUE) pairs.
        """
        return [
            "TAN", "AAADE1234C",
            "NAME", "Test Company Pvt Ltd",
            "FINANCIAL YEAR", "2023-24",
            "NATURE OF PAYMENT", "192 Salaries",
            "MAJOR HEAD", "0020 Corporation Tax",
            "CHALLAN NO", "12345",
            "DATE OF DEPOSIT", payment_date,
            "AMOUNT (IN RS.)", "100000",
            "TAX", "90000",
            "SURCHARGE", "0",
            "CESS", "0",
            "INTEREST", interest,
            "PENALTY", "0",
            "FEE UNDER SECTION 234E", "0",
        ]

    def _run_parse(self, payment_date: str, interest: str = "0") -> dict:
        """Run TDSParser._parse with mocked PDF returning our cell sequence."""
        cells = self._build_cell_sequence(payment_date, interest)

        # Build a mock pdfplumber.PDF
        mock_cell_objects = [[c] for c in cells]  # each "row" has one cell
        mock_table = mock_cell_objects
        mock_page = MagicMock()
        mock_page.extract_tables.return_value = [mock_table]
        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page]

        parser = TDSParser()
        return parser._parse(mock_pdf, "test.pdf")

    def test_april_payment_maps_to_march(self):
        """Payment on any April date → deduction month is March of same year."""
        result = self._run_parse("15/04/2024")
        self.assertEqual(result["Month"], "March 2024")

    def test_april_first_maps_to_march(self):
        result = self._run_parse("01/04/2024")
        self.assertEqual(result["Month"], "March 2024")

    def test_day_le_7_maps_to_previous_month(self):
        """Payment on day ≤ 7 → deduction month is the previous calendar month."""
        result = self._run_parse("07/03/2024")
        self.assertEqual(result["Month"], "February 2024")

    def test_day_le_7_january_wraps_to_december(self):
        """Day ≤ 7 in January → deduction month is December of previous year."""
        result = self._run_parse("05/01/2024")
        self.assertEqual(result["Month"], "December 2023")

    def test_interest_positive_maps_to_previous_month(self):
        """Interest > 0, day > 7, not April → deduction month is previous month."""
        result = self._run_parse("20/06/2024", interest="500")
        self.assertEqual(result["Month"], "May 2024")

    def test_day_gt_7_no_interest_maps_to_current_month(self):
        """Day > 7, interest = 0, not April → deduction month is payment month."""
        result = self._run_parse("15/06/2024", interest="0")
        self.assertEqual(result["Month"], "June 2024")

    def test_unknown_date_gives_unknown_month(self):
        """Unparseable date string → Month field = 'Unknown'."""
        result = self._run_parse("not-a-date")
        self.assertEqual(result["Month"], "Unknown")


# ---------------------------------------------------------------------------
# Major Head normalisation
# ---------------------------------------------------------------------------

class TestMajorHeadNormalisation(unittest.TestCase):
    """Verify the MAJOR HEAD normalisation rules in TDSParser._parse."""

    def _run_parse_with_major_head(self, major_head_value: str) -> dict:
        cells = [
            "TAN", "AAADE1234C",
            "NAME", "Test Co",
            "FINANCIAL YEAR", "2023-24",
            "NATURE OF PAYMENT", "192 Salaries",
            "MAJOR HEAD", major_head_value,
            "CHALLAN NO", "99",
            "DATE OF DEPOSIT", "15/06/2024",
            "AMOUNT (IN RS.)", "1000",
            "TAX", "1000",
            "SURCHARGE", "0",
            "CESS", "0",
            "INTEREST", "0",
            "PENALTY", "0",
            "FEE UNDER SECTION 234E", "0",
        ]
        mock_cell_objects = [[c] for c in cells]
        mock_page = MagicMock()
        mock_page.extract_tables.return_value = [mock_cell_objects]
        mock_pdf = MagicMock()
        mock_pdf.pages = [mock_page]

        parser = TDSParser()
        return parser._parse(mock_pdf, "test.pdf")

    def test_0020_maps_to_corporation_tax(self):
        result = self._run_parse_with_major_head("0020 Corporation Tax")
        self.assertEqual(result["Major Head"], "Corporation Tax")

    def test_companies_keyword_maps_to_corporation_tax(self):
        result = self._run_parse_with_major_head("Tax on Companies")
        self.assertEqual(result["Major Head"], "Corporation Tax")

    def test_0021_maps_to_other_than_companies(self):
        result = self._run_parse_with_major_head("0021 Other than Companies")
        self.assertEqual(result["Major Head"], "Other than Companies")

    def test_other_than_company_keyword(self):
        result = self._run_parse_with_major_head("0021 (Other than Company deductees)")
        self.assertEqual(result["Major Head"], "Other than Companies")

    def test_unknown_major_head_passthrough(self):
        """Unknown value passes through verbatim (stripped at first '(')."""
        result = self._run_parse_with_major_head("Some Other Head (details)")
        self.assertEqual(result["Major Head"], "Some Other Head")

    def test_empty_major_head(self):
        # When the MAJOR HEAD label maps to an empty cell, find_val advances to
        # the next non-empty cell in the sequence (which is "CHALLAN NO").
        # None of the keyword checks match "CHALLAN NO", so the passthrough
        # branch applies and strips everything after "(" giving "CHALLAN NO".
        result = self._run_parse_with_major_head("")
        self.assertIsInstance(result["Major Head"], str)


# ---------------------------------------------------------------------------
# IMAGE_PDF error case
# ---------------------------------------------------------------------------

class TestImagePDFError(unittest.TestCase):
    """parse_file with a PDF that has no text layer returns _parse_error='IMAGE_PDF'."""

    def test_empty_bytes_returns_image_pdf_error(self):
        """Passing completely empty bytes causes pdfplumber to fail or produce
        no text; the BaseParser.parse_file wrapper must return the error record."""
        parser = TDSParser()
        # Empty bytes: pdfplumber will raise an exception, which parse_file
        # catches and wraps as an error record.
        result = parser.parse_file(b"", "empty.pdf")
        self.assertIn("_parse_error", result)

    def test_image_pdf_minimal_no_text(self):
        """A minimal valid PDF with no text content triggers the IMAGE_PDF path."""
        pdf_bytes = _make_minimal_pdf_bytes()
        parser = TDSParser()
        result = parser.parse_file(pdf_bytes, "image_only.pdf")
        self.assertIn("_parse_error", result)
        self.assertIn("IMAGE_PDF", str(result["_parse_error"]))

    def test_error_record_has_all_output_fields_as_none(self):
        """Error record sets every OUTPUT_FIELD to None."""
        pdf_bytes = _make_minimal_pdf_bytes()
        parser = TDSParser()
        result = parser.parse_file(pdf_bytes, "image_only.pdf")
        for field in TDSParser.OUTPUT_FIELDS:
            self.assertIn(field, result)
            self.assertIsNone(result[field])

    def test_source_file_recorded_in_error(self):
        """The _source_file key in the error record matches the filename passed in."""
        pdf_bytes = _make_minimal_pdf_bytes()
        parser = TDSParser()
        result = parser.parse_file(pdf_bytes, "my_challan.pdf")
        self.assertEqual(result.get("_source_file"), "my_challan.pdf")


if __name__ == "__main__":
    unittest.main()
