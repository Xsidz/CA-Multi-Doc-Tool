"""Response Pydantic v2 models for all StatutorySync API endpoints."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class ParseBatchResponse(BaseModel):
    """Response body for POST /parse/{doc_type}."""

    doc_type: str = Field(
        ...,
        description="The document type that was parsed",
    )
    rows: list[dict[str, Any]] = Field(
        default_factory=list,
        description=(
            "Structured rows extracted from the uploaded files. "
            "For ESIC, rows include a 'Contribution Type' field (Employer / Employee). "
            "Rows are sorted chronologically by financial year + FY month order."
        ),
    )
    error_files: list[str] = Field(
        default_factory=list,
        description=(
            "List of filenames that could not be parsed, each suffixed with the "
            "error reason (e.g. 'myfile.pdf: image_pdf')."
        ),
    )
    total_parsed: int = Field(
        ...,
        description="Total number of successfully parsed rows across all files",
        ge=0,
    )


class SheetsExportResponse(BaseModel):
    """Response body for POST /export/sheets."""

    spreadsheet_id: str = Field(
        ...,
        description="The Google Sheets spreadsheet ID",
    )
    sheet_url: str = Field(
        ...,
        description="Direct URL to the Google Spreadsheet",
    )


class UsageResponse(BaseModel):
    """Response body for usage queries (returned by dependencies, not a route)."""

    user_id: str = Field(..., description="Supabase user ID")
    plan: str = Field(default="free", description="Current billing plan")
    files_used: int = Field(default=0, description="Files parsed in current period", ge=0)
    limit: int = Field(default=2, description="Maximum files allowed in current period", ge=0)
    period_start: Optional[str] = Field(
        default=None,
        description="ISO-8601 timestamp of current billing period start",
    )


class HealthResponse(BaseModel):
    """Response body for GET /health."""

    status: str = Field(default="ok")
    version: str = Field(default="1.0.0")
