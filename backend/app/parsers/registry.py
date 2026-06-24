"""Parser registry — maps doc_type keys to callable parse functions.

Each value is a callable: (file_bytes: bytes) -> list[dict[str, Any]]
"""
from app.parsers.esic import parse as esic_parse
from app.parsers.gstr3b import parse as gstr3b_parse
from app.parsers.pf_ecr import PFECRParser as _PFECRParser
from app.parsers.ptrc import parse as ptrc_parse
from app.parsers.tds_itns281 import TDSParser as _TDSParser

# PF ECR and TDS expose class-based interfaces; wrap to match callable signature
def _pf_parse(file_bytes: bytes):
    return _PFECRParser().parse(file_bytes)

def _tds_parse(file_bytes: bytes):
    parser = _TDSParser()
    result = parser.parse_file(file_bytes, "")
    # parse_file returns a single dict; wrap in list for consistent interface
    return [result]

PARSER_REGISTRY: dict[str, callable] = {
    "esic":        esic_parse,
    "gstr3b":      gstr3b_parse,
    "pf_ecr":      _pf_parse,
    "ptrc":        ptrc_parse,
    "tds_itns281": _tds_parse,
}

PLAN_LIMITS: dict[str, int] = {
    "free":     2,
    "starter":  25,
    "standard": 50,
    "pro":      120,
}

OUTPUT_FIELDS: dict[str, list[str]] = {
    "esic": [
        "Month", "Year", "Total ESIC Contribution Paid",
        "Challan Number", "Date of Payment",
    ],
    "gstr3b": [
        "Year", "Month", "GSTIN", "Company Name", "Trade Name",
        "Outward taxable supplies (other than zero rated, nil rated and exempted)",
        "Outward taxable supplies (zero rated)",
        "Other outward supplies (nil rated, exempted)",
        "Output IGST", "Output CGST", "Output SGST",
        "RCM Taxable Value", "RCM IGST Payable", "RCM CGST Payable", "RCM SGST Payable",
        "Total Input IGST", "Total Input CGST", "Total Input SGST",
        "Ineligible IGST", "Ineligible CGST", "Ineligible SGST",
        "Net Input IGST", "Net Input CGST", "Net Input SGST",
        "IGST to IGST", "IGST to CGST", "IGST to SGST",
        "CGST to IGST", "CGST to CGST",
        "SGST to IGST", "SGST to SGST",
        "IGST Payable", "CGST Payable", "SGST Payable",
        "Interest paid", "Late Fees paid", "Date of filing",
    ],
    "pf_ecr": [
        "Establishment_Code", "Establishment_Name", "Financial_Year", "Month",
        "Challan_Date", "Employer_EPF_AC01", "Employer_EPS_AC10", "Employer_EDLI_AC21",
        "Total_Employer_Contribution", "PF_Admin_AC02", "EDLI_Admin_AC22",
        "Total_Admin_Charges", "Total_Employer_incl_Admin",
        "Employee_EPF_AC01", "Grand_Total",
    ],
    "ptrc": [
        "Type of Return", "TAN", "Company Name",
        "PTRC return for the month", "Date of filing",
        "Year", "Month", "PT Paid", "Challan No.",
    ],
    "tds_itns281": [
        "TAN", "Company Name", "FY", "Month", "Section", "Major Head",
        "Total Amount Paid", "Tax", "Surcharge", "Cess", "Interest",
        "Penalty", "Fee under section 234E", "Crosscheck Diff",
        "Challan No", "Payment Date",
    ],
}
