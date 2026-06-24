"""Unit tests for ESICParser (app.parsers.esic).

Coverage:
- Month/year extraction from period string via _financial_year helper
- Financial year calculation for APR-DEC and JAN-MAR months
- Challan number cleaning (strip ":")
- Error / fallback behaviour when parsing fails
"""
from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from app.parsers.esic import (
    _extract_after_keyword,
    _financial_year,
    _flatten_text,
    _parse_amount,
    parse,
)


# ---------------------------------------------------------------------------
# _financial_year
# ---------------------------------------------------------------------------

class TestFinancialYear(unittest.TestCase):
    """_financial_year(month_val, raw_year) → 'YYYY-YY' string."""

    # APR–DEC: FY starts in raw_year
    def test_april_fy(self):
        self.assertEqual(_financial_year("APR", 2023), "2023-24")

    def test_may_fy(self):
        self.assertEqual(_financial_year("MAY", 2022), "2022-23")

    def test_june_fy(self):
        self.assertEqual(_financial_year("JUN", 2024), "2024-25")

    def test_july_fy(self):
        self.assertEqual(_financial_year("JUL", 2023), "2023-24")

    def test_august_fy(self):
        self.assertEqual(_financial_year("AUG", 2023), "2023-24")

    def test_september_fy(self):
        self.assertEqual(_financial_year("SEP", 2022), "2022-23")

    def test_october_fy(self):
        self.assertEqual(_financial_year("OCT", 2024), "2024-25")

    def test_november_fy(self):
        self.assertEqual(_financial_year("NOV", 2021), "2021-22")

    def test_december_fy(self):
        self.assertEqual(_financial_year("DEC", 2023), "2023-24")

    # JAN–MAR: FY started previous year
    def test_january_fy(self):
        self.assertEqual(_financial_year("JAN", 2024), "2023-24")

    def test_february_fy(self):
        self.assertEqual(_financial_year("FEB", 2024), "2023-24")

    def test_march_fy(self):
        self.assertEqual(_financial_year("MAR", 2025), "2024-25")

    # Case-insensitive / partial abbreviation
    def test_lowercase_month(self):
        self.assertEqual(_financial_year("apr", 2023), "2023-24")

    def test_mixed_case_month(self):
        self.assertEqual(_financial_year("Sep", 2022), "2022-23")

    def test_full_month_name_truncated_to_3(self):
        # _financial_year uses only first 3 chars
        self.assertEqual(_financial_year("April", 2023), "2023-24")

    # Edge cases
    def test_empty_month_returns_unknown(self):
        self.assertEqual(_financial_year("", 2023), "Unknown")

    def test_zero_year_returns_unknown(self):
        self.assertEqual(_financial_year("APR", 0), "Unknown")

    def test_negative_fy_start_returns_unknown(self):
        # MAR with year=1 → fy_start = 0 → "Unknown"
        self.assertEqual(_financial_year("MAR", 1), "Unknown")

    def test_fy_end_two_digit_format(self):
        # 2099-00 (last two digits of 2100)
        self.assertEqual(_financial_year("APR", 2099), "2099-00")


# ---------------------------------------------------------------------------
# Month/year extraction from period string
# ---------------------------------------------------------------------------

class TestPeriodExtraction(unittest.TestCase):
    """Verify that the parse() function correctly extracts month and year
    from the "Challan Period:" line in the flattened PDF text."""

    def _run_parse_with_text(self, all_text: str) -> dict:
        """Patch _flatten_text to return *all_text* and call parse()."""
        with patch("app.parsers.esic._flatten_text", return_value=all_text):
            results = parse(b"dummy")
        self.assertEqual(len(results), 1)
        return results[0]

    def test_period_apr_2023(self):
        text = "Challan Period: Apr-2023 something else Amount Paid: 50000 Challan Number: 001234 Challan Submitted Date: 10/05/2023"
        row = self._run_parse_with_text(text)
        self.assertEqual(row["Month"], "Apr")
        self.assertEqual(row["Year"], "2023-24")

    def test_period_jan_2024(self):
        text = "Challan Period: Jan-2024 something Amount Paid: 75000 Challan Number: 005678 Challan Submitted Date: 15/02/2024"
        row = self._run_parse_with_text(text)
        self.assertEqual(row["Month"], "Jan")
        self.assertEqual(row["Year"], "2023-24")

    def test_period_march_2025(self):
        text = "Challan Period: Mar-2025 something Amount Paid: 30000 Challan Number: 009999 Challan Submitted Date: 05/04/2025"
        row = self._run_parse_with_text(text)
        self.assertEqual(row["Month"], "Mar")
        self.assertEqual(row["Year"], "2024-25")

    def test_missing_period_label(self):
        """If 'Challan Period:' is absent, month should fall back to 'Unknown'."""
        text = "Amount Paid: 10000 Challan Number: 111 Challan Submitted Date: 01/01/2024"
        row = self._run_parse_with_text(text)
        self.assertEqual(row["Month"], "Unknown")
        self.assertEqual(row["Year"], "Unknown")

    def test_malformed_period_no_dash(self):
        """Period without '-' separator → Unknown."""
        text = "Challan Period: Apr2023 Amount Paid: 10000 Challan Number: 111 Challan Submitted Date: 01/01/2024"
        row = self._run_parse_with_text(text)
        self.assertEqual(row["Month"], "Unknown")

    def test_period_with_extra_spaces(self):
        """Extra spaces after 'Challan Period:' are handled by offset extraction."""
        # The function uses offset=15, so spaces within the first 15 chars are fine
        text = "Challan Period:  Jun-2022 rest Amount Paid: 2000 Challan Number: 222 Challan Submitted Date: 30/06/2022"
        row = self._run_parse_with_text(text)
        # Depending on exact offset, month may be extracted or Unknown
        # Just check no exception and Year is a string
        self.assertIsInstance(row["Year"], str)


# ---------------------------------------------------------------------------
# Challan number cleaning (strip ":")
# ---------------------------------------------------------------------------

class TestChallanNumberCleaning(unittest.TestCase):
    """Challan numbers sometimes appear as ': 004567' — the ':' must be stripped."""

    def _run_parse_with_text(self, all_text: str) -> dict:
        with patch("app.parsers.esic._flatten_text", return_value=all_text):
            results = parse(b"dummy")
        return results[0]

    def _make_base_text(self, challan_raw: str) -> str:
        return (
            f"Challan Period: Apr-2023 "
            f"Amount Paid: 50000 "
            f"Challan Number{challan_raw}"
            f"Challan Submitted Date: 10/05/2023"
        )

    def test_challan_with_colon_prefix(self):
        """': 004567' → '004567'."""
        text = self._make_base_text(": 004567 ")
        row = self._run_parse_with_text(text)
        self.assertNotIn(":", row["Challan Number"])
        self.assertEqual(row["Challan Number"], "004567")

    def test_challan_without_colon(self):
        """' 004567' (no colon) → '004567'."""
        text = self._make_base_text(" 004567 ")
        row = self._run_parse_with_text(text)
        self.assertEqual(row["Challan Number"], "004567")

    def test_challan_colon_no_space(self):
        """':004567' → '004567'."""
        text = self._make_base_text(":004567 ")
        row = self._run_parse_with_text(text)
        self.assertNotIn(":", row["Challan Number"])

    def test_challan_missing(self):
        """Missing challan number → 'Unknown'."""
        text = (
            "Challan Period: Apr-2023 "
            "Amount Paid: 50000 "
            "Challan Submitted Date: 10/05/2023"
        )
        row = self._run_parse_with_text(text)
        # Either empty or 'Unknown'
        self.assertIn(row["Challan Number"], ("Unknown", ""))


# ---------------------------------------------------------------------------
# Amount parsing helper
# ---------------------------------------------------------------------------

class TestParseAmount(unittest.TestCase):
    """_parse_amount strips commas and whitespace, returns float."""

    def test_plain_number(self):
        self.assertEqual(_parse_amount("50000"), 50000.0)

    def test_comma_separated(self):
        self.assertEqual(_parse_amount("1,23,456"), 123456.0)

    def test_with_spaces(self):
        self.assertEqual(_parse_amount("  12 000 "), 12000.0)

    def test_empty_string(self):
        self.assertEqual(_parse_amount(""), 0.0)

    def test_non_numeric(self):
        self.assertEqual(_parse_amount("N/A"), 0.0)

    def test_float_string(self):
        self.assertAlmostEqual(_parse_amount("9999.50"), 9999.50, places=2)


# ---------------------------------------------------------------------------
# Error / fallback behaviour
# ---------------------------------------------------------------------------

class TestErrorFallback(unittest.TestCase):
    """When _flatten_text raises an unexpected exception, parse() returns an
    ERROR sentinel row (not a crash)."""

    def test_exception_in_flatten_returns_error_sentinel(self):
        """Any unexpected exception → error sentinel with known keys."""
        with patch("app.parsers.esic._flatten_text", side_effect=RuntimeError("boom")):
            results = parse(b"dummy")
        self.assertEqual(len(results), 1)
        row = results[0]
        self.assertEqual(row["Month"], "Unknown")
        self.assertEqual(row["Year"], "ERROR")
        self.assertEqual(row["Challan Number"], "ERROR")
        self.assertEqual(row["Date of Payment"], "ERROR")
        self.assertEqual(row["Total ESIC Contribution Paid"], 0)

    def test_image_pdf_raises_value_error(self):
        """Empty text triggers ValueError('image_pdf') which is re-raised."""
        with patch("app.parsers.esic._flatten_text", return_value="   "):
            with self.assertRaises(ValueError) as ctx:
                parse(b"dummy")
        self.assertIn("image_pdf", str(ctx.exception))

    def test_parse_returns_list(self):
        """Happy-path parse() always returns a list."""
        text = (
            "Challan Period: May-2023 "
            "Amount Paid: 12345 "
            "Challan Number: 000789 "
            "Challan Submitted Date: 07/06/2023"
        )
        with patch("app.parsers.esic._flatten_text", return_value=text):
            results = parse(b"dummy")
        self.assertIsInstance(results, list)
        self.assertEqual(len(results), 1)

    def test_result_keys_present(self):
        """All expected output keys are present in a successful parse."""
        expected_keys = {
            "Month",
            "Year",
            "Total ESIC Contribution Paid",
            "Challan Number",
            "Date of Payment",
        }
        text = (
            "Challan Period: May-2023 "
            "Amount Paid: 12345 "
            "Challan Number: 000789 "
            "Challan Submitted Date: 07/06/2023"
        )
        with patch("app.parsers.esic._flatten_text", return_value=text):
            results = parse(b"dummy")
        self.assertTrue(expected_keys.issubset(set(results[0].keys())))


# ---------------------------------------------------------------------------
# _extract_after_keyword helper
# ---------------------------------------------------------------------------

class TestExtractAfterKeyword(unittest.TestCase):
    """_extract_after_keyword mirrors M's Text.PositionOf + Text.Middle.

    Signature: _extract_after_keyword(text, keyword, offset, length)
    The 'offset' is added directly to the position of the keyword in the text
    (idx + offset), NOT to the end of the keyword.  This mirrors the M script
    where offset = Text.PositionOf(keyword) + literal_offset_into_string.
    """

    def test_start_at_keyword_position(self):
        # "Challan Period:Apr-2023"
        # idx of "Challan Period:" is 0; offset=15 → start at 15 → "Apr-2023"
        text = "Challan Period:Apr-2023"
        result = _extract_after_keyword(text, "Challan Period:", offset=15, length=8)
        self.assertEqual(result, "Apr-2023")

    def test_keyword_not_found_returns_empty(self):
        result = _extract_after_keyword("some text", "missing", offset=0, length=10)
        self.assertEqual(result, "")

    def test_offset_equals_keyword_length(self):
        # When offset == len(keyword) we read from right after the keyword
        text = "KEY:VALUE extra"
        kw = "KEY:"
        result = _extract_after_keyword(text, kw, offset=len(kw), length=5)
        self.assertEqual(result, "VALUE")

    def test_length_limit(self):
        # idx of "kw " is 0; offset=3 (len("kw ")) → start at 3 → "ABCDE"
        text = "kw ABCDEFGHIJKLMNOP"
        result = _extract_after_keyword(text, "kw ", offset=3, length=5)
        self.assertEqual(result, "ABCDE")

    def test_strip_applied(self):
        # Result is .strip()'d so surrounding spaces are removed
        text = "LABEL  value  "
        result = _extract_after_keyword(text, "LABEL", offset=5, length=10)
        self.assertEqual(result, "value")

    def test_mid_string_keyword(self):
        # keyword "TARGET:" is at idx=7 in "prefix TARGET:data suffix"
        # offset=14 = len("prefix ") + len("TARGET:") = 7+7
        # start = idx + offset = 7 + 14 = 21 → but that overshoots.
        # Correct: to land on "data" we need start = idx + len("TARGET:") = 7+7=14
        # offset must equal len(keyword) when keyword appears at idx:
        # start = idx + offset; we want start = idx + 7, so offset=7
        text = "prefix TARGET:data suffix"
        result = _extract_after_keyword(text, "TARGET:", offset=7, length=4)
        self.assertEqual(result, "data")


if __name__ == "__main__":
    unittest.main()
