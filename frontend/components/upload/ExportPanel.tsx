"use client";

import { useState } from "react";
import { FileDown, Sheet, Lock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface ExportPanelProps {
  rows: Record<string, unknown>[];
  docType: string;
  plan: string;
  sheetsConnected: boolean;
  onExcelDownload: () => Promise<void>;
  onSheetsExport: () => Promise<void>;
}

export function ExportPanel({
  rows,
  docType,
  plan,
  sheetsConnected,
  onExcelDownload,
  onSheetsExport,
}: ExportPanelProps) {
  const { toast } = useToast();
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [exportingSheets, setExportingSheets] = useState(false);

  const isFreeUser = plan === "free";
  const hasRows = rows.length > 0;

  async function handleExcel() {
    if (!hasRows) return;
    setDownloadingExcel(true);
    try {
      await onExcelDownload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Download failed";
      toast({ title: "Export failed", description: message, variant: "destructive" });
    } finally {
      setDownloadingExcel(false);
    }
  }

  async function handleSheets() {
    if (!hasRows || isFreeUser) return;
    if (!sheetsConnected) return; // button is disabled; guard anyway
    setExportingSheets(true);
    try {
      await onSheetsExport();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Export failed";
      toast({ title: "Sheets export failed", description: message, variant: "destructive" });
    } finally {
      setExportingSheets(false);
    }
  }

  // ─── Sheets button state ────────────────────────────────────────────────────
  //  free user          → disabled + upgrade tooltip
  //  paid, !connected   → "Connect Google Sheets" link
  //  paid, connected    → enabled button

  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      {/* Excel download */}
      <Button
        onClick={handleExcel}
        disabled={downloadingExcel || !hasRows}
        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white"
      >
        <FileDown className="h-4 w-4" />
        {downloadingExcel ? "Downloading..." : "Download Excel"}
      </Button>

      {/* Google Sheets */}
      {isFreeUser ? (
        <div className="relative group">
          <Button
            variant="outline"
            disabled
            className="flex items-center gap-2 opacity-60 cursor-not-allowed border-secondary/40 text-secondary"
          >
            <Lock className="h-4 w-4" />
            Export to Google Sheets
          </Button>
          {/* Tooltip */}
          <div
            className={cn(
              "absolute bottom-full left-0 mb-2 w-60 bg-foreground text-white text-xs rounded-lg px-3 py-2",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20 shadow-lg"
            )}
            role="tooltip"
          >
            Upgrade to Starter to export to Google Sheets
          </div>
        </div>
      ) : !sheetsConnected ? (
        /* Paid but not connected → show connect link */
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled
            className="flex items-center gap-2 opacity-50 cursor-not-allowed border-secondary/40 text-secondary"
          >
            <Sheet className="h-4 w-4" />
            Export to Google Sheets
          </Button>
          <a
            href="/settings"
            className="inline-flex items-center gap-1 text-xs text-secondary underline underline-offset-2 hover:text-secondary/80 transition-colors"
          >
            Connect Google Sheets
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : (
        /* Paid + connected */
        <Button
          onClick={handleSheets}
          disabled={exportingSheets || !hasRows}
          className="flex items-center gap-2 bg-secondary hover:bg-secondary/90 text-white"
        >
          <Sheet className="h-4 w-4" />
          {exportingSheets ? "Exporting..." : "Export to Google Sheets"}
        </Button>
      )}
    </div>
  );
}
