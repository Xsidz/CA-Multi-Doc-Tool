"""Pydantic output schemas for AI-assisted parsing.

All fields are Optional[...] = None by default.
This enforces the no-hallucination contract:
- Model MUST return null for missing fields rather than guessing
- instructor retries automatically if model returns invalid JSON
- Type annotations prevent string hallucinations in numeric fields
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class TDSOutput(BaseModel):
    """TDS ITNS281 challan — 16 fields."""
    TAN: Optional[str] = None
    company_name: Optional[str] = Field(None, alias="Company Name")
    financial_year: Optional[str] = Field(None, alias="FY")
    month: Optional[str] = Field(None, alias="Month")
    section: Optional[str] = Field(None, alias="Section")
    major_head: Optional[str] = Field(None, alias="Major Head")
    total_amount_paid: Optional[float] = Field(None, alias="Total Amount Paid")
    tax: Optional[float] = Field(None, alias="Tax")
    surcharge: Optional[float] = Field(None, alias="Surcharge")
    cess: Optional[float] = Field(None, alias="Cess")
    interest: Optional[float] = Field(None, alias="Interest")
    penalty: Optional[float] = Field(None, alias="Penalty")
    fee_234e: Optional[float] = Field(None, alias="Fee under section 234E")
    crosscheck_diff: Optional[float] = Field(None, alias="Crosscheck Diff")
    challan_no: Optional[str] = Field(None, alias="Challan No")
    payment_date: Optional[str] = Field(None, alias="Payment Date")

    model_config = {"populate_by_name": True}

    def to_output_dict(self) -> dict:
        return {
            "TAN": self.TAN,
            "Company Name": self.company_name,
            "FY": self.financial_year,
            "Month": self.month,
            "Section": self.section,
            "Major Head": self.major_head,
            "Total Amount Paid": self.total_amount_paid,
            "Tax": self.tax,
            "Surcharge": self.surcharge,
            "Cess": self.cess,
            "Interest": self.interest,
            "Penalty": self.penalty,
            "Fee under section 234E": self.fee_234e,
            "Crosscheck Diff": self.crosscheck_diff,
            "Challan No": self.challan_no,
            "Payment Date": self.payment_date,
        }


class GSTR3BOutput(BaseModel):
    """GSTR-3B monthly return — key fields."""
    year: Optional[str] = Field(None, alias="Year")
    month: Optional[str] = Field(None, alias="Month")
    gstin: Optional[str] = Field(None, alias="GSTIN")
    company_name: Optional[str] = Field(None, alias="Company Name")
    trade_name: Optional[str] = Field(None, alias="Trade Name")
    output_igst: Optional[float] = Field(None, alias="Output IGST")
    output_cgst: Optional[float] = Field(None, alias="Output CGST")
    output_sgst: Optional[float] = Field(None, alias="Output SGST")
    rcm_taxable_value: Optional[float] = Field(None, alias="RCM Taxable Value")
    rcm_igst: Optional[float] = Field(None, alias="RCM IGST Payable")
    rcm_cgst: Optional[float] = Field(None, alias="RCM CGST Payable")
    rcm_sgst: Optional[float] = Field(None, alias="RCM SGST Payable")
    total_input_igst: Optional[float] = Field(None, alias="Total Input IGST")
    total_input_cgst: Optional[float] = Field(None, alias="Total Input CGST")
    total_input_sgst: Optional[float] = Field(None, alias="Total Input SGST")
    ineligible_igst: Optional[float] = Field(None, alias="Ineligible IGST")
    ineligible_cgst: Optional[float] = Field(None, alias="Ineligible CGST")
    ineligible_sgst: Optional[float] = Field(None, alias="Ineligible SGST")
    net_input_igst: Optional[float] = Field(None, alias="Net Input IGST")
    net_input_cgst: Optional[float] = Field(None, alias="Net Input CGST")
    net_input_sgst: Optional[float] = Field(None, alias="Net Input SGST")
    igst_payable: Optional[float] = Field(None, alias="IGST Payable")
    cgst_payable: Optional[float] = Field(None, alias="CGST Payable")
    sgst_payable: Optional[float] = Field(None, alias="SGST Payable")
    interest_paid: Optional[float] = Field(None, alias="Interest paid")
    late_fees_paid: Optional[float] = Field(None, alias="Late Fees paid")
    date_of_filing: Optional[str] = Field(None, alias="Date of filing")

    model_config = {"populate_by_name": True}

    def to_output_dict(self) -> dict:
        return {
            "Year": self.year, "Month": self.month,
            "GSTIN": self.gstin, "Company Name": self.company_name,
            "Trade Name": self.trade_name,
            "Outward taxable supplies (other than zero rated, nil rated and exempted)": None,
            "Outward taxable supplies (zero rated)": None,
            "Other outward supplies (nil rated, exempted)": None,
            "Output IGST": self.output_igst, "Output CGST": self.output_cgst, "Output SGST": self.output_sgst,
            "RCM Taxable Value": self.rcm_taxable_value,
            "RCM IGST Payable": self.rcm_igst, "RCM CGST Payable": self.rcm_cgst, "RCM SGST Payable": self.rcm_sgst,
            "Total Input IGST": self.total_input_igst, "Total Input CGST": self.total_input_cgst, "Total Input SGST": self.total_input_sgst,
            "Ineligible IGST": self.ineligible_igst, "Ineligible CGST": self.ineligible_cgst, "Ineligible SGST": self.ineligible_sgst,
            "Net Input IGST": self.net_input_igst, "Net Input CGST": self.net_input_cgst, "Net Input SGST": self.net_input_sgst,
            "IGST to IGST": None, "IGST to CGST": None, "IGST to SGST": None,
            "CGST to IGST": None, "CGST to CGST": None, "SGST to IGST": None, "SGST to SGST": None,
            "IGST Payable": self.igst_payable, "CGST Payable": self.cgst_payable, "SGST Payable": self.sgst_payable,
            "Interest paid": self.interest_paid, "Late Fees paid": self.late_fees_paid,
            "Date of filing": self.date_of_filing,
        }


class ESICOutput(BaseModel):
    """ESIC challan — per-file fields (grouping happens in pdf_service)."""
    month: Optional[str] = Field(None, alias="Month")
    year: Optional[str] = Field(None, alias="Year")
    total_esic: Optional[float] = Field(None, alias="Total ESIC Contribution Paid")
    challan_number: Optional[str] = Field(None, alias="Challan Number")
    date_of_payment: Optional[str] = Field(None, alias="Date of Payment")

    model_config = {"populate_by_name": True}

    def to_output_dict(self) -> dict:
        return {
            "Month": self.month,
            "Year": self.year,
            "Total ESIC Contribution Paid": self.total_esic,
            "Challan Number": self.challan_number,
            "Date of Payment": self.date_of_payment,
        }


class PFECROutput(BaseModel):
    """PF ECR challan — 15 fields."""
    establishment_code: Optional[str] = Field(None, alias="Establishment_Code")
    establishment_name: Optional[str] = Field(None, alias="Establishment_Name")
    financial_year: Optional[str] = Field(None, alias="Financial_Year")
    month: Optional[str] = Field(None, alias="Month")
    challan_date: Optional[str] = Field(None, alias="Challan_Date")
    employer_epf: Optional[float] = Field(None, alias="Employer_EPF_AC01")
    employer_eps: Optional[float] = Field(None, alias="Employer_EPS_AC10")
    employer_edli: Optional[float] = Field(None, alias="Employer_EDLI_AC21")
    total_employer: Optional[float] = Field(None, alias="Total_Employer_Contribution")
    pf_admin: Optional[float] = Field(None, alias="PF_Admin_AC02")
    edli_admin: Optional[float] = Field(None, alias="EDLI_Admin_AC22")
    total_admin: Optional[float] = Field(None, alias="Total_Admin_Charges")
    total_employer_incl_admin: Optional[float] = Field(None, alias="Total_Employer_incl_Admin")
    employee_epf: Optional[float] = Field(None, alias="Employee_EPF_AC01")
    grand_total: Optional[float] = Field(None, alias="Grand_Total")

    model_config = {"populate_by_name": True}

    def to_output_dict(self) -> dict:
        return {
            "Establishment_Code": self.establishment_code,
            "Establishment_Name": self.establishment_name,
            "Financial_Year": self.financial_year,
            "Month": self.month,
            "Challan_Date": self.challan_date,
            "Employer_EPF_AC01": self.employer_epf,
            "Employer_EPS_AC10": self.employer_eps,
            "Employer_EDLI_AC21": self.employer_edli,
            "Total_Employer_Contribution": self.total_employer,
            "PF_Admin_AC02": self.pf_admin,
            "EDLI_Admin_AC22": self.edli_admin,
            "Total_Admin_Charges": self.total_admin,
            "Total_Employer_incl_Admin": self.total_employer_incl_admin,
            "Employee_EPF_AC01": self.employee_epf,
            "Grand_Total": self.grand_total,
        }


class PTRCOutput(BaseModel):
    """PTRC Maharashtra PT challan — 9 fields."""
    type_of_return: Optional[str] = Field(None, alias="Type of Return")
    tan: Optional[str] = Field(None, alias="TAN")
    company_name: Optional[str] = Field(None, alias="Company Name")
    ptrc_return_month: Optional[str] = Field(None, alias="PTRC return for the month")
    date_of_filing: Optional[str] = Field(None, alias="Date of filing")
    year: Optional[str] = Field(None, alias="Year")
    month: Optional[str] = Field(None, alias="Month")
    pt_paid: Optional[float] = Field(None, alias="PT Paid")
    challan_no: Optional[str] = Field(None, alias="Challan No.")

    model_config = {"populate_by_name": True}

    def to_output_dict(self) -> dict:
        return {
            "Type of Return": self.type_of_return,
            "TAN": self.tan,
            "Company Name": self.company_name,
            "PTRC return for the month": self.ptrc_return_month,
            "Date of filing": self.date_of_filing,
            "Year": self.year,
            "Month": self.month,
            "PT Paid": self.pt_paid,
            "Challan No.": self.challan_no,
        }


# Registry: doc_type → (Pydantic model class, field count for threshold)
AI_SCHEMA_REGISTRY: dict[str, type] = {
    "tds_itns281": TDSOutput,
    "gstr3b": GSTR3BOutput,
    "esic": ESICOutput,
    "pf_ecr": PFECROutput,
    "ptrc": PTRCOutput,
}
