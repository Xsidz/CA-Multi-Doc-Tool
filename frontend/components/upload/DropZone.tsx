"use client";

import { useCallback, useState } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { Upload, X, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onFilesAccepted: (files: File[]) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mapRejectionMessage(code: string): string {
  switch (code) {
    case "file-invalid-type":
      return "Only PDF files accepted";
    case "file-too-large":
      return "File too large (max 10 MB)";
    case "too-many-files":
      return "Max 20 files allowed";
    default:
      return "File rejected";
  }
}

export function DropZone({ onFilesAccepted }: DropZoneProps) {
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback(
    (accepted: File[]) => {
      const merged = [...files, ...accepted].slice(0, 20);
      setFiles(merged);
      onFilesAccepted(merged);
    },
    [files, onFilesAccepted]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: { "application/pdf": [".pdf"] },
      maxSize: 10 * 1024 * 1024,
      maxFiles: 20,
      noClick: false,
    });

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    onFilesAccepted(next);
  }

  const hasErrors = fileRejections.length > 0;

  return (
    <div className="space-y-3">
      {/* Drop area */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150",
          isDragActive
            ? "border-accent bg-accent/5 scale-[1.01]"
            : hasErrors
            ? "border-destructive bg-destructive/5"
            : "border-border hover:border-primary/40 hover:bg-muted/40"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
              isDragActive
                ? "bg-accent/15"
                : hasErrors
                ? "bg-destructive/10"
                : "bg-muted"
            )}
          >
            <Upload
              className={cn(
                "h-6 w-6",
                isDragActive
                  ? "text-accent"
                  : hasErrors
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            />
          </div>

          {isDragActive ? (
            <p className="text-accent font-semibold text-sm">Drop PDFs here...</p>
          ) : (
            <>
              <p className="text-foreground font-medium text-sm">
                Drag &amp; drop PDFs here, or{" "}
                <span className="text-secondary underline underline-offset-2 cursor-pointer">
                  browse files
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                PDF only &middot; Max 10 MB per file &middot; Up to 20 files
              </p>
            </>
          )}
        </div>
      </div>

      {/* Rejection errors */}
      {fileRejections.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 space-y-1">
          {fileRejections.map(({ file, errors }: FileRejection) => (
            <div key={`${file.name}-${file.size}`} className="flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>
                <span className="font-medium">{file.name}</span>
                {" — "}
                {errors.map((e) => mapRejectionMessage(e.code)).join(", ")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Accepted file list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {files.length} file{files.length !== 1 ? "s" : ""} selected
          </p>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {files.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center gap-3 px-3 py-2 bg-white border border-border rounded-lg text-sm group hover:border-primary/30 transition-colors"
              >
                <FileText className="h-4 w-4 text-secondary flex-shrink-0" />
                <span className="flex-1 truncate text-foreground text-xs">
                  {file.name}
                </span>
                <span className="text-muted-foreground text-xs flex-shrink-0 mr-1">
                  {formatSize(file.size)}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
