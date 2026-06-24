// ---------------------------------------------------------------------------
// Shared doc-type discriminator
// ---------------------------------------------------------------------------

export type DocType = 'gstr3b' | 'esic' | 'pf_ecr' | 'ptrc' | 'tds_itns281'

// ---------------------------------------------------------------------------
// Per-doc-type row shapes
// These mirror the OUTPUT_FIELDS / return dicts of each Python parser.
// ---------------------------------------------------------------------------

// ── GSTR-3B ────────────────────────────────────────────────────────────────

export interface GSTR3BRow {
  Year: string
  Month: string
  GSTIN: string
  'Company Name': string
  'Trade Name': string
  // Table 3.1 taxable values
  'Outward taxable supplies (other than zero rated, nil rated and exempted)': number
  'Outward taxable supplies (zero rated)': number
  'Other outward supplies (nil rated, exempted)': number
  // Output taxes
  'Output IGST': number
  'Output CGST': number
  'Output SGST': number
  // RCM
  'RCM Taxable Value': number
  'RCM IGST Payable': number
  'RCM CGST Payable': number
  'RCM SGST Payable': number
  // ITC
  'Total Input IGST': number
  'Total Input CGST': number
  'Total Input SGST': number
  'Ineligible IGST': number
  'Ineligible CGST': number
  'Ineligible SGST': number
  'Net Input IGST': number
  'Net Input CGST': number
  'Net Input SGST': number
  // Table 6.1 utilisation matrix
  'IGST to IGST': number
  'IGST to CGST': number
  'IGST to SGST': number
  'CGST to IGST': number
  'CGST to CGST': number
  'SGST to IGST': number
  'SGST to SGST': number
  // Derived payables
  'IGST Payable': number
  'CGST Payable': number
  'SGST Payable': number
  // Penalties / fees
  'Interest paid': number
  'Late Fees paid': number
  'Date of filing': string
  // Internal validation flags (optional, present only when issues detected)
  _needs_review?: boolean
  _review_reasons?: string[]
}

// ── ESIC ───────────────────────────────────────────────────────────────────

export interface ESICRow {
  /** Month abbreviation, e.g. "Apr" */
  Month: string
  /** Financial year string, e.g. "2023-24" */
  Year: string
  'Total ESIC Contribution Paid': number
  'Challan Number': string
  'Date of Payment': string
}

// ── PF ECR ─────────────────────────────────────────────────────────────────

export interface PFECRRow {
  Establishment_Code: string
  Establishment_Name: string
  Financial_Year: string
  Month: string
  Challan_Date: string
  Employer_EPF_AC01: number
  Employer_EPS_AC10: number
  Employer_EDLI_AC21: number
  Total_Employer_Contribution: number
  PF_Admin_AC02: number
  EDLI_Admin_AC22: number
  Total_Admin_Charges: number
  Total_Employer_incl_Admin: number
  Employee_EPF_AC01: number
  Grand_Total: number
}

// ── PTRC ───────────────────────────────────────────────────────────────────

export interface PTRCRow {
  'Type of Return': string
  TAN: string
  'Company Name': string
  /** PTRC deduction month, e.g. "Dec 2023" */
  'PTRC return for the month': string
  'Date of filing': string
  Year: string
  /** Payment month, e.g. "January 2024" */
  Month: string
  'PT Paid': number
  'Challan No.': string
}

// ── TDS ITNS-281 ────────────────────────────────────────────────────────────

export interface TDSRow {
  TAN: string
  'Company Name': string
  /** Financial year string, e.g. "2023-24" */
  FY: string
  /** Deduction month derived from payment date, e.g. "March 2024" */
  Month: string
  /** TDS section code, e.g. "192" */
  Section: string
  /** "Corporation Tax" | "Other than Companies" | passthrough */
  'Major Head': string
  'Total Amount Paid': number
  Tax: number
  Surcharge: number
  Cess: number
  Interest: number
  Penalty: number
  'Fee under section 234E': number
  /** total_amount - (tax + surcharge + cess + interest + penalty + fee_234e) */
  'Crosscheck Diff': number
  'Challan No': string
  /** ISO-8601 date string, e.g. "2024-04-15", or null */
  'Payment Date': string | null
}

// ---------------------------------------------------------------------------
// Parse error record (returned by BaseParser._error_record)
// ---------------------------------------------------------------------------

export interface ParseErrorRecord {
  _parse_error: string
  _source_file: string
  [field: string]: null | string
}

// ---------------------------------------------------------------------------
// Union of all possible row types
// ---------------------------------------------------------------------------

export type ParsedRow =
  | GSTR3BRow
  | ESICRow
  | PFECRRow
  | PTRCRow
  | TDSRow
  | ParseErrorRecord

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export interface ParseBatchResponse {
  /** The document type that was parsed */
  doc_type: DocType
  /**
   * Structured rows extracted from the uploaded files.
   * Rows are sorted chronologically by financial year + FY month order.
   */
  rows: Record<string, unknown>[]
  /**
   * Filenames that could not be parsed, each suffixed with the error reason,
   * e.g. "my_challan.pdf: IMAGE_PDF".
   */
  error_files: string[]
  /** Total number of successfully parsed rows across all files */
  total_parsed: number
}

export interface SheetsExportResponse {
  /** The Google Sheets spreadsheet ID */
  spreadsheet_id: string
  /** Direct browser URL to the Google Spreadsheet */
  sheet_url: string
}

export interface UsageResponse {
  user_id: string
  plan: 'free' | 'starter' | 'standard' | 'pro'
  files_used: number
  /** Maximum files allowed in the current billing period */
  limit: number
  /** ISO-8601 timestamp of current billing period start */
  period_start: string | null
}

export interface ComposioStatusResponse {
  connected: boolean
}
