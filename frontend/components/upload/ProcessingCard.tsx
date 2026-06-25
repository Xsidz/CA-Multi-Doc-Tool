"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2, Circle, Zap } from "lucide-react";
import type { FileStatusItem } from "./FileStatusList";
import { cn } from "@/lib/utils";

interface ProcessingCardProps {
  files: FileStatusItem[];
  docTypeLabel: string;
}

export function ProcessingCard({ files, docTypeLabel }: ProcessingCardProps) {
  const total = files.length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter(
    (f) => f.status === "error_image" || f.status === "error_parse"
  ).length;
  const completedCount = doneCount + errorCount;
  const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/3 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
          <Zap className="h-3.5 w-3.5 text-accent animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-primary">
          Parsing {total} {docTypeLabel} file{total !== 1 ? "s" : ""}
        </p>
        <span className="ml-auto text-xs font-mono text-muted-foreground tabular-nums">
          {completedCount}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
        <div
          className="h-full bg-secondary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Per-file list */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {files.map((file, idx) => (
          <FileProgressRow key={`${file.name}-${idx}`} file={file} />
        ))}
      </div>
    </div>
  );
}

function FileProgressRow({ file }: { file: FileStatusItem }) {
  const [stage, setStage] = useState(0);
  const stages = ["Reading document...", "Extracting fields...", "Verifying data..."];

  useEffect(() => {
    if (file.status !== "processing") return;
    setStage(0);
    const t1 = setTimeout(() => setStage(1), 1500);
    const t2 = setTimeout(() => setStage(2), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [file.status]);

  const isDone = file.status === "done";
  const isError = file.status === "error_image" || file.status === "error_parse";
  const isProcessing = file.status === "processing";
  const isQueued = file.status === "queued";

  return (
    <div className="flex items-center gap-2.5 text-xs">
      {/* Status icon */}
      <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
        {isDone ? (
          <CheckCircle className="h-3.5 w-3.5 text-secondary" />
        ) : isError ? (
          <div className="w-3.5 h-3.5 rounded-full bg-destructive/20 flex items-center justify-center">
            <span className="text-destructive text-[9px] font-bold">!</span>
          </div>
        ) : isProcessing ? (
          <Loader2 className="h-3.5 w-3.5 text-accent animate-spin" />
        ) : (
          <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
        )}
      </div>

      {/* Filename */}
      <span className={cn(
        "flex-1 truncate font-medium",
        isDone ? "text-foreground" : isError ? "text-destructive" : isProcessing ? "text-foreground" : "text-muted-foreground"
      )}>
        {file.name}
      </span>

      {/* Right status */}
      <span className={cn(
        "flex-shrink-0 tabular-nums",
        isDone ? "text-secondary" : isProcessing ? "text-accent" : "text-muted-foreground/60"
      )}>
        {isDone
          ? `${file.fieldCount ?? "—"} fields`
          : isError
          ? "error"
          : isProcessing
          ? stages[stage]
          : "queued"}
      </span>
    </div>
  );
}
