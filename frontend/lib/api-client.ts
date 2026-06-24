import { createBrowserClient } from '@/lib/supabase/client'
import type { ParseBatchResponse, SheetsExportResponse } from '@/types/parsers'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class PlanLimitError extends Error {
  constructor(
    public used: number,
    public limit: number,
    public upgradeUrl: string,
  ) {
    super('Plan limit exceeded')
    this.name = 'PlanLimitError'
  }
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getAuthToken(): Promise<string> {
  const supabase = createBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please log in.')
  }
  return session.access_token
}

// ---------------------------------------------------------------------------
// Document parsing
// ---------------------------------------------------------------------------

/**
 * Upload one or more files for a given doc type.
 * Throws PlanLimitError (HTTP 402) when the user has exceeded their plan limit.
 */
export async function parseDocuments(
  docType: string,
  files: File[],
): Promise<ParseBatchResponse> {
  const token = await getAuthToken()
  const formData = new FormData()
  files.forEach(f => formData.append('files', f))

  const res = await fetch(`${API_URL}/api/v1/parse/${docType}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (res.status === 402) {
    const err = await res.json()
    const detail = err.detail ?? err
    throw new PlanLimitError(
      detail.used ?? 0,
      detail.limit ?? 2,
      detail.upgrade_url ?? '/settings/billing',
    )
  }

  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ---------------------------------------------------------------------------
// Excel export
// ---------------------------------------------------------------------------

/**
 * Export parsed rows to an Excel file (.xlsx).
 * Returns a Blob that can be downloaded client-side.
 */
export async function exportExcel(
  docType: string,
  rows: Record<string, unknown>[],
): Promise<Blob> {
  const token = await getAuthToken()

  const res = await fetch(`${API_URL}/api/v1/export/excel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ doc_type: docType, rows }),
  })

  if (!res.ok) throw new Error(await res.text())
  return res.blob()
}

// ---------------------------------------------------------------------------
// Google Sheets export
// ---------------------------------------------------------------------------

/**
 * Export parsed rows to Google Sheets via Composio.
 * Optionally appends to an existing spreadsheet when spreadsheetId is provided.
 */
export async function exportSheets(
  docType: string,
  rows: Record<string, unknown>[],
  spreadsheetId?: string,
): Promise<SheetsExportResponse> {
  const token = await getAuthToken()

  const res = await fetch(`${API_URL}/api/v1/export/sheets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ doc_type: docType, rows, spreadsheet_id: spreadsheetId }),
  })

  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ---------------------------------------------------------------------------
// Composio / Google Sheets connection status
// ---------------------------------------------------------------------------

/**
 * Check whether the current user has connected their Google Sheets account
 * via Composio.
 */
export async function getComposioStatus(): Promise<{ connected: boolean }> {
  const token = await getAuthToken()

  const res = await fetch(`${API_URL}/api/v1/composio/status`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  return res.json()
}

// ---------------------------------------------------------------------------
// Generic HTTP helpers (used by pages via apiClient.get / apiClient.post)
// ---------------------------------------------------------------------------

async function apiGet<T>(path: string): Promise<T> {
  const token = await getAuthToken()
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 402) {
    const err = await res.json()
    const detail = err.detail ?? err
    throw new PlanLimitError(detail.used ?? 0, detail.limit ?? 2, detail.upgrade_url ?? '/settings/billing')
  }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getAuthToken()
  const isFormData = body instanceof FormData
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: 'POST',
    headers: isFormData
      ? { Authorization: `Bearer ${token}` }
      : { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: isFormData ? body : JSON.stringify(body),
  })
  if (res.status === 402) {
    const err = await res.json()
    const detail = err.detail ?? err
    throw new PlanLimitError(detail.used ?? 0, detail.limit ?? 2, detail.upgrade_url ?? '/settings/billing')
  }
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ---------------------------------------------------------------------------
// Convenience namespace — supports both named imports and apiClient.* pattern
// ---------------------------------------------------------------------------

export const apiClient = {
  parseDocuments,
  exportExcel,
  exportSheets,
  getComposioStatus,
  get: apiGet,
  post: apiPost,
}
