"""Request Pydantic v2 models for all StatutorySync API endpoints."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class ExcelExportRequest(BaseModel):
    """Payload for POST /export/excel."""

    doc_type: str = Field(
        ...,
        description="Document type key (esic, pf_ecr, ptrc, tds, gstr3b)",
        min_length=1,
    )
    rows: list[dict[str, Any]] = Field(
        ...,
        description="Parsed rows to export; each dict is one spreadsheet row",
    )

    @field_validator("rows")
    @classmethod
    def rows_must_not_be_empty(cls, v: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not v:
            raise ValueError("rows must contain at least one entry")
        return v


class SheetsExportRequest(BaseModel):
    """Payload for POST /export/sheets."""

    doc_type: str = Field(
        ...,
        description="Document type key (esic, pf_ecr, ptrc, tds, gstr3b)",
        min_length=1,
    )
    rows: list[dict[str, Any]] = Field(
        ...,
        description="Parsed rows to write to the spreadsheet",
    )
    spreadsheet_id: Optional[str] = Field(
        default=None,
        description=(
            "Existing Google Spreadsheet ID to append to. "
            "If omitted, a new spreadsheet is created."
        ),
    )

    @field_validator("rows")
    @classmethod
    def rows_must_not_be_empty(cls, v: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not v:
            raise ValueError("rows must contain at least one entry")
        return v
