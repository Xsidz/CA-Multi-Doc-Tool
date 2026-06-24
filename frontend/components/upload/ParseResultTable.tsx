"use client";

const MAX_PREVIEW_ROWS = 10;

interface ParseResultTableProps {
  rows: Record<string, unknown>[];
  docType: string;
}

export function ParseResultTable({ rows, docType }: ParseResultTableProps) {
  if (rows.length === 0) return null;

  const headers = Object.keys(rows[0]);
  const previewRows = rows.slice(0, MAX_PREVIEW_ROWS);
  const remaining = rows.length - previewRows.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Preview — {rows.length} row{rows.length !== 1 ? "s" : ""} parsed from{" "}
          <span className="uppercase font-semibold text-primary">{docType}</span>
        </h3>
        {remaining > 0 && (
          <p className="text-xs text-muted-foreground">Showing 10 of {rows.length}</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-primary">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-white font-semibold whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={rowIdx % 2 === 0 ? "bg-white" : "bg-background"}
              >
                {headers.map((h) => (
                  <td key={h} className="px-3 py-2 text-foreground whitespace-nowrap">
                    {row[h] !== null && row[h] !== undefined ? String(row[h]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {remaining > 0 && (
          <div className="px-3 py-2 bg-muted border-t border-border text-xs text-muted-foreground text-center">
            and {remaining} more row{remaining !== 1 ? "s" : ""} in the export
          </div>
        )}
      </div>
    </div>
  );
}
