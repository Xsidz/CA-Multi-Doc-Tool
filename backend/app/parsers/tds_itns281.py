import io
import re
from datetime import date
from typing import Any
import pdfplumber
from app.parsers.base import BaseParser


class TDSParser(BaseParser):
    DOC_TYPE = "tds_itns281"
    OUTPUT_FIELDS = [
        "TAN", "Company Name", "FY", "Month", "Section", "Major Head",
        "Total Amount Paid", "Tax", "Surcharge", "Cess", "Interest",
        "Penalty", "Fee under section 234E", "Crosscheck Diff",
        "Challan No", "Payment Date"
    ]

    def _parse(self, pdf: pdfplumber.PDF, filename: str) -> dict[str, Any]:
        # Build sequence array from all PDF cells
        all_cells = []
        for page in pdf.pages:
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    for row in table:
                        for cell in row:
                            if cell:
                                all_cells.append(str(cell).strip())
            else:
                words = page.extract_words()
                all_cells.extend(w["text"] for w in words if w.get("text"))

        # Build a label→value dict for "Label : Value" format (new PDF style)
        # e.g. "TAN : MUMG22556C" → {"TAN": "MUMG22556C"}
        kv: dict[str, str] = {}
        for cell in all_cells:
            if " : " in cell:
                parts = cell.split(" : ", 1)
                label = parts[0].strip().upper()
                value = parts[1].strip()
                kv[label] = value
            elif "\n" in cell:
                # multi-line: "A Tax ₹ 1,34,723" style — handled separately
                pass

        # Also build the classic sequence array (old PDF style: separate cells)
        clean_orig = [c.strip().replace(":", "").strip() for c in all_cells if c and c.strip()]
        clean_orig = [c for c in clean_orig if c]
        clean_upper = [c.upper() for c in clean_orig]

        def find_idx(label: str) -> int:
            try:
                return clean_upper.index(label.upper())
            except ValueError:
                return -1

        def find_val(label: str) -> str:
            # Try kv dict first (new format), fall back to sequence array (old format)
            label_up = label.upper()
            if label_up in kv:
                return kv[label_up]
            # Partial match in kv keys
            for k, v in kv.items():
                if label_up in k:
                    return v
            # Sequence array fallback
            idx = find_idx(label)
            if idx >= 0 and idx + 1 < len(clean_orig):
                return clean_orig[idx + 1]
            return ""

        def find_val_between(lbl1: str, lbl2: str) -> str:
            # Try kv first
            v = find_val(lbl1)
            if v:
                return v
            idx1 = find_idx(lbl1)
            idx2 = find_idx(lbl2)
            if idx1 >= 0 and idx2 > idx1:
                return " ".join(clean_orig[idx1 + 1:idx2])
            return ""

        # Extract fields
        tan_val = find_val("TAN") or "Unknown"

        company_raw = find_val_between("NAME", "FINANCIAL YEAR")
        ass_idx = company_raw.upper().find("ASSESSMENT YEAR")
        company_name = company_raw[:ass_idx].strip() if ass_idx >= 0 else company_raw

        fy_val = find_val("FINANCIAL YEAR")

        nop_raw = find_val("NATURE OF PAYMENT")
        section_val = nop_raw.split()[0] if nop_raw else "Unknown"

        major_head_raw = find_val("MAJOR HEAD")
        mh_upper = major_head_raw.upper()
        if "OTHER THAN COMPAN" in mh_upper or "0021" in mh_upper:
            major_head = "Other than Companies"
        elif "COMPAN" in mh_upper or "CORPORATION" in mh_upper or "0020" in mh_upper:
            major_head = "Corporation Tax"
        else:
            major_head = major_head_raw.split("(")[0].strip()

        challan_no = find_val("CHALLAN NO")

        pdate_str = find_val("DATE OF DEPOSIT") or find_val("TENDER DATE")
        payment_date = None
        for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%Y-%m-%d",
                    "%d-%b-%Y", "%d-%B-%Y", "%d/%b/%Y", "%d %b %Y", "%d %B %Y"]:
            try:
                from datetime import datetime
                payment_date = datetime.strptime(pdate_str, fmt).date()
                break
            except (ValueError, TypeError):
                continue

        # Amount fields — handle both "AMOUNT (IN RS.)" key and "A Tax ₹ 1,34,723" inline cell
        def extract_amount_from_cells(keyword: str) -> float:
            """Search cells for keyword, extract the LAST number (after the ₹ sign)."""
            for cell in all_cells:
                cu = cell.upper()
                if keyword.upper() in cu:
                    # Split on ₹ or currency symbol — value is after it
                    parts = re.split(r"[₹\?]", cell)
                    if len(parts) > 1:
                        return self.clean_number(parts[-1].strip())
                    # Fallback: last numeric token
                    nums = re.findall(r"[\d,]+(?:\.\d+)?", cell)
                    if nums:
                        return self.clean_number(nums[-1].replace(",", ""))
            return 0.0

        total_amount = self.clean_number(find_val("AMOUNT (IN RS.)")) or extract_amount_from_cells("TOTAL")
        tax = self.clean_number(find_val("TAX")) or extract_amount_from_cells("A TAX") or extract_amount_from_cells("A  TAX")
        surcharge = self.clean_number(find_val("SURCHARGE")) or extract_amount_from_cells("B SURCHARGE")
        cess = self.clean_number(find_val("CESS")) or extract_amount_from_cells("C CESS")
        interest = self.clean_number(find_val("INTEREST")) or extract_amount_from_cells("D INTEREST")
        penalty = self.clean_number(find_val("PENALTY")) or extract_amount_from_cells("E PENALTY")
        fee_234e = self.clean_number(find_val("FEE UNDER SECTION 234E")) or extract_amount_from_cells("F FEE UNDER SECTION")
        crosscheck = total_amount - (tax + surcharge + cess + interest + penalty + fee_234e)

        # TDS month logic — replicates M script lines 97-113
        tds_month = "Unknown"
        if payment_date:
            p_day = payment_date.day
            p_month = payment_date.month
            p_year = payment_date.year
            from datetime import date
            from dateutil.relativedelta import relativedelta
            if p_month == 4:
                deduction_date = date(p_year, 3, 1)
            elif p_day <= 7:
                deduction_date = (date(p_year, p_month, 1) - relativedelta(months=1))
            elif interest > 0:
                deduction_date = (date(p_year, p_month, 1) - relativedelta(months=1))
            else:
                deduction_date = date(p_year, p_month, 1)
            import calendar
            tds_month = f"{calendar.month_name[deduction_date.month]} {deduction_date.year}"

        return {
            "TAN": tan_val,
            "Company Name": company_name,
            "FY": fy_val,
            "Month": tds_month,
            "Section": section_val,
            "Major Head": major_head,
            "Total Amount Paid": total_amount,
            "Tax": tax,
            "Surcharge": surcharge,
            "Cess": cess,
            "Interest": interest,
            "Penalty": penalty,
            "Fee under section 234E": fee_234e,
            "Crosscheck Diff": crosscheck,
            "Challan No": challan_no,
            "Payment Date": payment_date.isoformat() if payment_date else None,
        }
