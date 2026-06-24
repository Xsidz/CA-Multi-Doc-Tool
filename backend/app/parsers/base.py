import io
import re
from abc import ABC, abstractmethod
from typing import Any
import pdfplumber

class BaseParser(ABC):
    DOC_TYPE: str = ""
    OUTPUT_FIELDS: list[str] = []

    MONTH_FY_ORDER = {
        "APR": 1, "MAY": 2, "JUN": 3, "JUL": 4, "AUG": 5, "SEP": 6,
        "OCT": 7, "NOV": 8, "DEC": 9, "JAN": 10, "FEB": 11, "MAR": 12
    }

    def parse_file(self, file_bytes: bytes, filename: str) -> dict[str, Any]:
        try:
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                # Detect image-only PDF (no text)
                all_text = self.flatten_text(pdf)
                if len(all_text.strip()) < 20:
                    raise ValueError("IMAGE_PDF: No text layer detected")
                return self._parse(pdf, filename)
        except ValueError as e:
            if "IMAGE_PDF" in str(e):
                return self._error_record(filename, "IMAGE_PDF")
            return self._error_record(filename, str(e))
        except Exception as e:
            return self._error_record(filename, str(e))

    @abstractmethod
    def _parse(self, pdf: pdfplumber.PDF, filename: str) -> dict[str, Any]:
        ...

    def _error_record(self, filename: str, detail: str) -> dict[str, Any]:
        record = {f: None for f in self.OUTPUT_FIELDS}
        record["_parse_error"] = detail
        record["_source_file"] = filename
        return record

    @staticmethod
    def flatten_text(pdf: pdfplumber.PDF) -> str:
        # Replicates: Pdf.Tables -> Table.Combine -> AllCellsText -> AllTextStr
        # Sorts words by (top, x0) for correct reading order
        all_words = []
        for page in pdf.pages:
            words = page.extract_words(x_tolerance=3, y_tolerance=3, keep_blank_chars=False)
            all_words.extend(words)
        # Sort by vertical position then horizontal
        all_words.sort(key=lambda w: (round(w.get("top", 0) / 5) * 5, w.get("x0", 0)))
        return " ".join(w["text"].strip() for w in all_words if w["text"].strip())

    @staticmethod
    def extract_after_keyword(text: str, keyword: str, length: int = 30) -> str:
        # Replicates: Text.PositionOf + Text.Middle(str, idx + len(keyword), length)
        idx = text.find(keyword)
        if idx < 0:
            return ""
        return text[idx + len(keyword): idx + len(keyword) + length].strip()

    @staticmethod
    def extract_between(text: str, start_kw: str, end_kw: str) -> str:
        idx1 = text.find(start_kw)
        if idx1 < 0:
            return ""
        idx2 = text.find(end_kw, idx1 + len(start_kw))
        if idx2 < 0:
            return ""
        return text[idx1 + len(start_kw): idx2].strip()

    @staticmethod
    def clean_number(s: str) -> float:
        # Replicates N() helper: strips commas, NBSP (chr160), newlines, Rs -> float or 0
        if not s:
            return 0.0
        cleaned = re.sub(r"[,\s ₹]", "", str(s).strip())
        if cleaned in ("", "-"):
            return 0.0
        try:
            return float(cleaned)
        except (ValueError, TypeError):
            return 0.0

    @staticmethod
    def clean_number_strict(s: str) -> float:
        # TDS variant: keeps only digits and "-" (strips everything else)
        if not s:
            return 0.0
        chars = [c for c in str(s) if c.isdigit() or c == "-"]
        cleaned = "".join(chars)
        if not cleaned or cleaned == "-":
            return 0.0
        try:
            return float(cleaned)
        except (ValueError, TypeError):
            return 0.0

    @staticmethod
    def financial_year(month_str: str, year_int: int) -> str:
        # APR-DEC -> fy_start = year_int; JAN-MAR -> fy_start = year_int - 1
        # Returns "2024-25" format
        q1_to_q3 = {"APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"}
        m = month_str.upper()[:3] if month_str else ""
        fy_start = year_int if m in q1_to_q3 else year_int - 1
        if fy_start == 0:
            return "Unknown"
        return f"{fy_start}-{str(fy_start + 1)[-2:]}"

    @staticmethod
    def get_first_digit_idx(s: str) -> int:
        for i, c in enumerate(s):
            if c.isdigit():
                return i
        return -1

    def month_fy_order(self, month_str: str) -> int:
        if not month_str:
            return 99
        return self.MONTH_FY_ORDER.get(month_str.upper()[:3], 99)
