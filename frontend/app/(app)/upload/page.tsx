"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { DocTypeSelector } from "@/components/upload/DocTypeSelector";
import { DropZone } from "@/components/upload/DropZone";
import { FileStatusList, type FileStatusItem } from "@/components/upload/FileStatusList";
import { ParseResultTable } from "@/components/upload/ParseResultTable";
import { ExportPanel } from "@/components/upload/ExportPanel";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { Button } from "@/components/ui/button";
import { apiClient, parseDocuments, PlanLimitError } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
import { usePlanGate } from "@/hooks/usePlanGate";
import { createBrowserClient } from "@/lib/supabase/client";
import type { ParseBatchResponse, DocType } from "@/types/parsers";

// ─── State machine ────────────────────────────────────────────────────────────

type PageState = "idle" | "uploading" | "processing" | "done" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string | null> {
  const supabase = createBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const { toast } = useToast();
  const { plan } = usePlanGate();

  // State machine
  const [pageState, setPageState] = useState<PageState>("idle");

  // Doc type selection
  const [docType, setDocType] = useState<DocType>("gstr3b");

  // Files (raw File objects from DropZone)
  const [files, setFiles] = useState<File[]>([]);

  // Per-file status for FileStatusList
  const [fileStatuses, setFileStatuses] = useState<FileStatusItem[]>([]);

  // Parse result
  const [parseResult, setParseResult] = useState<ParseBatchResponse | null>(null);

  // Upgrade modal
  const [upgradeModal, setUpgradeModal] = useState<{
    open: boolean;
    used: number;
    limit: number;
  }>({ open: false, used: 0, limit: 2 });

  // Google Sheets connection
  const [sheetsConnected, setSheetsConnected] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ connected: boolean }>("/composio/status")
      .then((res) => setSheetsConnected(res.connected))
      .catch(() => setSheetsConnected(false));
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function handleFilesAccepted(accepted: File[]) {
    setFiles(accepted);
    setFileStatuses(
      accepted.map((f) => ({
        name: f.name,
        status: "queued" as const,
      }))
    );
    setParseResult(null);
    setPageState(accepted.length > 0 ? "idle" : "idle");
  }

  async function handleProcess() {
    if (files.length === 0) return;

    setPageState("uploading");

    // Mark all queued → processing
    setFileStatuses((prev) =>
      prev.map((f) => ({ ...f, status: "processing" as const }))
    );

    setPageState("processing");

    try {
      const result = await parseDocuments(docType, files);

      setParseResult(result);
      setPageState("done");

      // Update per-file statuses from result
      setFileStatuses((prev) =>
        prev.map((f) => {
          const errorEntry = result.error_files.find((e) =>
            e.startsWith(f.name)
          );

          if (errorEntry) {
            const parts = errorEntry.split(":");
            const errorType = parts[1] ?? "unknown";
            if (errorType === "image_pdf") {
              return { ...f, status: "error_image" as const };
            }
            return {
              ...f,
              status: "error_parse" as const,
              error: errorType,
            };
          }

          return {
            ...f,
            status: "done" as const,
            fieldCount: Object.keys(result.rows[0] ?? {}).length,
          };
        })
      );

      toast({
        title: "Parsing complete",
        description: `${result.total_parsed} row${result.total_parsed !== 1 ? "s" : ""} extracted from ${files.length} file${files.length !== 1 ? "s" : ""}.`,
      });
    } catch (err: unknown) {
      if (err instanceof PlanLimitError) {
        // Show upgrade modal instead of error toast
        setUpgradeModal({ open: true, used: err.used, limit: err.limit });
        // Revert file statuses to queued
        setFileStatuses((prev) =>
          prev.map((f) => ({ ...f, status: "queued" as const }))
        );
        setPageState("idle");
        return;
      }

      const message = err instanceof Error ? err.message : "Parse failed";
      toast({ title: "Error", description: message, variant: "destructive" });

      setFileStatuses((prev) =>
        prev.map((f) => ({
          ...f,
          status: "error_parse" as const,
          error: "Request failed",
        }))
      );
      setPageState("error");
    }
  }

  // ─── Excel download ───────────────────────────────────────────────────────

  const handleExcelDownload = useCallback(async () => {
    if (!parseResult) return;

    const token = await getAuthToken();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/export/excel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          doc_type: parseResult.doc_type,
          rows: parseResult.rows,
        }),
      }
    );

    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docType}_export.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [parseResult, docType]);

  // ─── Google Sheets export ─────────────────────────────────────────────────

  const handleSheetsExport = useCallback(async () => {
    if (!parseResult) return;

    const result = await apiClient.post<{ spreadsheet_id: string; sheet_url: string }>(
      "/export/sheets",
      { doc_type: parseResult.doc_type, rows: parseResult.rows }
    );

    toast({
      title: "Exported to Google Sheets",
      description: "Spreadsheet created successfully.",
    });

    window.open(result.sheet_url, "_blank");
  }, [parseResult, toast]);

  // ─── Derived UI state ─────────────────────────────────────────────────────

  const isProcessing = pageState === "uploading" || pageState === "processing";
  const canProcess = files.length > 0 && !isProcessing;
  const showResults =
    parseResult !== null && parseResult.rows.length > 0 && pageState === "done";

  return (
    <div className="space-y-6 pb-10">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-primary tracking-tight">Upload &amp; Parse</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Select the document type, upload PDFs, then export structured data.
        </p>
      </div>

      {/* 1. Document type */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Document Type
        </label>
        <DocTypeSelector selected={docType} onSelect={(v) => setDocType(v as DocType)} />
      </div>

      {/* 2. Drop zone */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Upload Files
        </label>
        <DropZone onFilesAccepted={handleFilesAccepted} />
      </div>

      {/* 3. File statuses + process button */}
      {fileStatuses.length > 0 && (
        <div className="space-y-4">
          <FileStatusList files={fileStatuses} />

          <div className="flex justify-end">
            <Button
              onClick={handleProcess}
              disabled={!canProcess}
              className="min-w-[160px] bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </span>
              ) : (
                `Process ${files.length} File${files.length !== 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 4. Results + export */}
      {showResults && parseResult && (
        <div className="space-y-4 pt-2">
          <ParseResultTable rows={parseResult.rows} docType={parseResult.doc_type} />
          <ExportPanel
            rows={parseResult.rows}
            docType={parseResult.doc_type}
            plan={plan}
            sheetsConnected={sheetsConnected}
            onExcelDownload={handleExcelDownload}
            onSheetsExport={handleSheetsExport}
          />
        </div>
      )}

      {/* Upgrade modal (shown on 402) */}
      <UpgradeModal
        open={upgradeModal.open}
        onClose={() => setUpgradeModal((s) => ({ ...s, open: false }))}
        used={upgradeModal.used}
        limit={upgradeModal.limit}
      />
    </div>
  );
}
