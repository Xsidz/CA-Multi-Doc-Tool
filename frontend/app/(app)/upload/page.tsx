"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, AlertTriangle, FileCheck2 } from "lucide-react";
import { DocTypeSelector } from "@/components/upload/DocTypeSelector";
import { DropZone } from "@/components/upload/DropZone";
import { FileStatusList, type FileStatusItem } from "@/components/upload/FileStatusList";
import { ProcessingCard } from "@/components/upload/ProcessingCard";
import { ParseResultTable } from "@/components/upload/ParseResultTable";
import { ExportPanel } from "@/components/upload/ExportPanel";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { Button } from "@/components/ui/button";
import { apiClient, parseDocuments, PlanLimitError } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
import { usePlanGate } from "@/hooks/usePlanGate";
import { createBrowserClient } from "@/lib/supabase/client";
import type { ParseBatchResponse, DocType } from "@/types/parsers";
import { cn } from "@/lib/utils";

type PageState = "idle" | "uploading" | "processing" | "done" | "error";

const DOC_TYPE_LABELS: Record<string, string> = {
  gstr3b: "GSTR-3B",
  esic: "ESIC",
  pf_ecr: "PF ECR",
  ptrc: "PTRC",
  tds_itns281: "TDS ITNS281",
};

async function getAuthToken(): Promise<string | null> {
  const supabase = createBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// Step indicator component
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Choose type" },
    { n: 2, label: "Upload PDFs" },
    { n: 3, label: "Export" },
  ];
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                step === s.n
                  ? "bg-accent text-foreground"
                  : step > s.n
                  ? "bg-secondary text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {step > s.n ? "✓" : s.n}
            </div>
            <span
              className={cn(
                "text-xs font-medium transition-colors",
                step === s.n ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn("w-8 h-px mx-2", step > s.n ? "bg-secondary" : "bg-border")} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function UploadPage() {
  const { toast } = useToast();
  const { plan } = usePlanGate();
  const resultsRef = useRef<HTMLDivElement>(null);

  const [pageState, setPageState] = useState<PageState>("idle");
  const [docType, setDocType] = useState<DocType>("gstr3b");
  const [files, setFiles] = useState<File[]>([]);
  const [fileStatuses, setFileStatuses] = useState<FileStatusItem[]>([]);
  const [parseResult, setParseResult] = useState<ParseBatchResponse | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; used: number; limit: number }>({
    open: false, used: 0, limit: 2,
  });
  const [sheetsConnected, setSheetsConnected] = useState(false);

  // Guard: pending doc type switch when files already loaded
  const [pendingDocType, setPendingDocType] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ connected: boolean }>("/composio/status")
      .then((res) => setSheetsConnected(res.connected))
      .catch(() => setSheetsConnected(false));
  }, []);

  // Auto-scroll to results when done
  useEffect(() => {
    if (pageState === "done" && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [pageState]);

  function handleFilesAccepted(accepted: File[]) {
    setFiles(accepted);
    setFileStatuses(accepted.map((f) => ({ name: f.name, status: "queued" as const })));
    setParseResult(null);
    setPageState("idle");
  }

  function handleDocTypeSelect(v: string) {
    // If files are loaded and we're idle, show confirmation
    if (files.length > 0 && pageState === "idle") {
      setPendingDocType(v);
      return;
    }
    setDocType(v as DocType);
  }

  function confirmDocTypeSwitch() {
    if (!pendingDocType) return;
    setDocType(pendingDocType as DocType);
    setFiles([]);
    setFileStatuses([]);
    setParseResult(null);
    setPageState("idle");
    setPendingDocType(null);
  }

  async function handleProcess() {
    if (files.length === 0) return;
    setPageState("uploading");

    // Stagger files into "processing" state for a natural feel (150ms each)
    files.forEach((f, i) => {
      setTimeout(() => {
        setFileStatuses((prev) =>
          prev.map((s) => s.name === f.name ? { ...s, status: "processing" as const } : s)
        );
      }, i * 150);
    });

    setPageState("processing");

    try {
      const result = await parseDocuments(docType, files);
      setParseResult(result);

      // Stagger completion transitions — files land one by one
      const updatedStatuses = files.map((f) => {
        const errorEntry = result.error_files.find((e) => e.startsWith(f.name));
        if (errorEntry) {
          const errorType = errorEntry.split(":")[1] ?? "unknown";
          return errorType === "image_pdf"
            ? { name: f.name, status: "error_image" as const }
            : { name: f.name, status: "error_parse" as const, error: errorType };
        }
        const nonInternalFields = Object.keys(result.rows[0] ?? {}).filter((k) => !k.startsWith("_"));
        return { name: f.name, status: "done" as const, fieldCount: nonInternalFields.length };
      });

      updatedStatuses.forEach((s, i) => {
        setTimeout(() => {
          setFileStatuses((prev) => prev.map((f) => f.name === s.name ? s : f));
        }, i * 200);
      });

      // Delay setting "done" state until stagger animation completes
      setTimeout(() => {
        setPageState("done");
        toast({
          title: "Parsing complete",
          description: `${result.total_parsed} row${result.total_parsed !== 1 ? "s" : ""} extracted from ${files.length} file${files.length !== 1 ? "s" : ""}.`,
        });
      }, updatedStatuses.length * 200 + 100);
    } catch (err: unknown) {
      if (err instanceof PlanLimitError) {
        setUpgradeModal({ open: true, used: err.used, limit: err.limit });
        setFileStatuses((prev) => prev.map((f) => ({ ...f, status: "queued" as const })));
        setPageState("idle");
        return;
      }
      const message = err instanceof Error ? err.message : "Parse failed";
      toast({ title: "Error", description: message, variant: "destructive" });
      setFileStatuses((prev) =>
        prev.map((f) => ({ ...f, status: "error_parse" as const, error: "Request failed" }))
      );
      setPageState("error");
    }
  }

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
        body: JSON.stringify({ doc_type: parseResult.doc_type, rows: parseResult.rows }),
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

  const handleSheetsExport = useCallback(async () => {
    if (!parseResult) return;
    const result = await apiClient.post<{ spreadsheet_id: string; sheet_url: string }>(
      "/export/sheets",
      { doc_type: parseResult.doc_type, rows: parseResult.rows }
    );
    toast({ title: "Exported to Google Sheets", description: "Spreadsheet created successfully." });
    window.open(result.sheet_url, "_blank");
  }, [parseResult, toast]);

  const isProcessing = pageState === "uploading" || pageState === "processing";
  const canProcess = files.length > 0 && !isProcessing;
  const showResults = parseResult !== null && parseResult.rows.length > 0 && pageState === "done";

  // Compute current step
  const currentStep: 1 | 2 | 3 = showResults ? 3 : files.length > 0 ? 2 : 1;
  const docTypeLabel = DOC_TYPE_LABELS[docType] ?? docType.toUpperCase();

  return (
    <div className="space-y-6 pb-10">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-primary tracking-tight">Upload &amp; Parse</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Select the document type, upload PDFs, then export structured data.
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator step={currentStep} />

      {/* 1. Document type */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Step 1 — Document Type
        </label>
        <DocTypeSelector selected={docType} onSelect={handleDocTypeSelect} />
      </div>

      {/* Doc type switch confirmation */}
      {pendingDocType && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 items-start">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Change document type?</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Switching to <strong>{DOC_TYPE_LABELS[pendingDocType] ?? pendingDocType}</strong> will
              remove the {files.length} PDF{files.length !== 1 ? "s" : ""} you&apos;ve already added.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={() => setPendingDocType(null)}
              >
                Keep current
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={confirmDocTypeSwitch}
              >
                Switch &amp; discard files
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Drop zone */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Step 2 — Upload Files
        </label>
        <DropZone onFilesAccepted={handleFilesAccepted} />
      </div>

      {/* File summary + process */}
      {fileStatuses.length > 0 && (
        <div className="space-y-4">
          {/* Summary pill — only when idle */}
          {!isProcessing && pageState !== "done" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileCheck2 className="h-4 w-4 text-secondary" />
              <span>
                <strong className="text-foreground">{files.length} PDF{files.length !== 1 ? "s" : ""}</strong> ready
                — will be parsed as <strong className="text-secondary">{docTypeLabel}</strong>
              </span>
            </div>
          )}

          {/* Processing card — shown while processing, replaces plain list */}
          {isProcessing ? (
            <ProcessingCard files={fileStatuses} docTypeLabel={docTypeLabel} />
          ) : (
            <FileStatusList files={fileStatuses} />
          )}

          {!isProcessing && pageState !== "done" && (
            <div className="flex justify-end">
              <Button
                onClick={handleProcess}
                disabled={!canProcess}
                className="min-w-[200px] bg-accent hover:bg-accent/90 text-foreground font-semibold"
              >
                {`Process ${files.length} PDF${files.length !== 1 ? "s" : ""} as ${docTypeLabel}`}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Results + export */}
      {showResults && parseResult && (
        <div ref={resultsRef} className="space-y-4 pt-2 scroll-mt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1 w-8 bg-secondary rounded-full" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Step 3 — Export Results
            </span>
          </div>
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

      <UpgradeModal
        open={upgradeModal.open}
        onClose={() => setUpgradeModal((s) => ({ ...s, open: false }))}
        used={upgradeModal.used}
        limit={upgradeModal.limit}
      />
    </div>
  );
}
