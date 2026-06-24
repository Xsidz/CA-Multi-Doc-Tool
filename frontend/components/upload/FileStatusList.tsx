"use client";

import { FileText, CheckCircle, AlertCircle, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileStatusItem {
  name: string;
  status: "queued" | "processing" | "done" | "error_image" | "error_parse";
  fieldCount?: number;
  error?: string;
}

interface FileStatusListProps {
  files: FileStatusItem[];
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function StatusBadge({ file }: { file: FileStatusItem }) {
  switch (file.status) {
    case "queued":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
          <Clock className="h-3 w-3" />
          Queued
        </span>
      );

    case "processing":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing...
        </span>
      );

    case "done":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20">
          <CheckCircle className="h-3 w-3" />
          {file.fieldCount !== undefined
            ? `${file.fieldCount} field${file.fieldCount !== 1 ? "s" : ""} extracted`
            : "Done"}
        </span>
      );

    case "error_image":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 max-w-xs truncate">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          Image PDF — OCR not supported in V1
        </span>
      );

    case "error_parse":
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 max-w-xs truncate"
          title={file.error ? `Parse failed: ${file.error}` : undefined}
        >
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {file.error ? `Parse failed: ${file.name}` : "Parse failed"}
        </span>
      );

    default:
      return null;
  }
}

// ─── Row bg color by status ───────────────────────────────────────────────────

function rowClass(status: FileStatusItem["status"]): string {
  switch (status) {
    case "processing":
      return "border-accent/30 bg-accent/5";
    case "done":
      return "border-secondary/30 bg-secondary/5";
    case "error_image":
    case "error_parse":
      return "border-destructive/30 bg-destructive/5";
    default:
      return "border-border bg-white";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FileStatusList({ files }: FileStatusListProps) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {files.length} file{files.length !== 1 ? "s" : ""}
      </h3>
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
        {files.map((file, idx) => (
          <div
            key={`${file.name}-${idx}`}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 border rounded-lg text-sm transition-all duration-150",
              rowClass(file.status)
            )}
          >
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="flex-1 truncate text-foreground text-xs font-medium">
              {file.name}
            </span>
            <StatusBadge file={file} />
          </div>
        ))}
      </div>
    </div>
  );
}
