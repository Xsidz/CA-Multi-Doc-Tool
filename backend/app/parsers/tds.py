"""TDS (Tax Deducted at Source) challan PDF parser."""
from __future__ import annotations

import io
import re
from typing import Any

import pdfplumber


def parse(file_bytes: bytes) -> list[dict[str, Any]]:
    """Parse a TDS challan / Form 26QB / OLTAS PDF and return structured rows."""
    rows: list[dict[str, Any]] = []

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        full_text = "\n".join(page.extract_text() or "" for page in pdf.pages)

    if not full_text.strip():
        raise ValueError("image_pdf")

    # Extract TAN
    tan_match = re.search(r"\b([A-Z]{4}[0-9]{5}[A-Z]{1})\b", full_text)
    tan = tan_match.group(1) if tan_match else ""

    # Extract PAN (deductor)
    pan_match = re.search(r"\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b", full_text)
    pan = pan_match.group(1) if pan_match else ""

    # Extract assessment year
    ay_match = re.search(r"Assessment Year\s*[:\-]\s*(\d{4}-\d{2,4})", full_text, re.IGNORECASE)
    assessment_year = ay_match.group(1) if ay_match else ""

    # Extract period (quarter)
    quarter_match = re.search(r"Quarter\s*[:\-]\s*(Q[1-4])", full_text, re.IGNORECASE)
    quarter = quarter_match.group(1) if quarter_match else ""

    # Extract section code
    section_match = re.search(r"Section\s*[:\-]?\s*(194[A-Z]?|192[A-Z]?|195)", full_text, re.IGNORECASE)
    section_code = section_match.group(1) if section_match else ""

    # Extract challan / BSR code
    bsr_match = re.search(r"BSR Code\s*[:\-]?\s*(\d+)", full_text, re.IGNORECASE)
    bsr_code = bsr_match.group(1) if bsr_match else ""

    challan_match = re.search(r"Challan\s*(?:Serial\s*)?No\.?\s*[:\-]?\s*(\d+)", full_text, re.IGNORECASE)
    challan_no = challan_match.group(1) if challan_match else ""

    # Extract date of deposit
    date_match = re.search(r"(?:Date of Deposit|Deposit Date)\s*[:\-]?\s*(\d{2}[/\-]\d{2}[/\-]\d{4})", full_text, re.IGNORECASE)
    deposit_date = date_match.group(1) if date_match else ""

    # Extract amounts
    tds_match = re.search(r"(?:TDS Amount|Tax Deducted)\s*[:\-]?\s*([\d,]+\.\d{2})", full_text, re.IGNORECASE)
    surcharge_match = re.search(r"Surcharge\s*[:\-]?\s*([\d,]+\.\d{2})", full_text, re.IGNORECASE)
    cess_match = re.search(r"(?:Education Cess|Cess)\s*[:\-]?\s*([\d,]+\.\d{2})", full_text, re.IGNORECASE)
    interest_match = re.search(r"Interest\s*[:\-]?\s*([\d,]+\.\d{2})", full_text, re.IGNORECASE)
    penalty_match = re.search(r"(?:Penalty|Fee)\s*[:\-]?\s*([\d,]+\.\d{2})", full_text, re.IGNORECASE)
    total_match = re.search(r"Total(?:\s+Amount)?\s*[:\-]?\s*([\d,]+\.\d{2})", full_text, re.IGNORECASE)

    tds_amount = _parse_amount(tds_match.group(1)) if tds_match else 0.0
    surcharge = _parse_amount(surcharge_match.group(1)) if surcharge_match else 0.0
    cess = _parse_amount(cess_match.group(1)) if cess_match else 0.0
    interest = _parse_amount(interest_match.group(1)) if interest_match else 0.0
    penalty = _parse_amount(penalty_match.group(1)) if penalty_match else 0.0
    total = _parse_amount(total_match.group(1)) if total_match else tds_amount + surcharge + cess + interest + penalty

    rows.append({
        "TAN": tan,
        "PAN": pan,
        "Assessment Year": assessment_year,
        "Quarter": quarter,
        "Section Code": section_code,
        "BSR Code": bsr_code,
        "Challan No": challan_no,
        "Date of Deposit": deposit_date,
        "TDS Amount": tds_amount,
        "Surcharge": surcharge,
        "Education Cess": cess,
        "Interest": interest,
        "Penalty/Fee": penalty,
        "Total Amount": total,
    })

    return rows


def _parse_amount(value: str) -> float:
    try:
        return float(value.replace(",", ""))
    except (ValueError, AttributeError):
        return 0.0
