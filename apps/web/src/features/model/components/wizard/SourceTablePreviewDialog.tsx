import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@datam8/ui";
import { Loader2 } from "lucide-react";
import { fetchSourcePreview, type SourcePreviewTableRef } from "./sourcePreview";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataSource: string;
  table: SourcePreviewTableRef | null;
  limit?: number;
};

function formatCellValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function SourceTablePreviewDialog({ open, onOpenChange, dataSource, table, limit = 10 }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [columns, setColumns] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !table || !dataSource) return;

    let active = true;
    setLoading(true);
    setError(null);

    void fetchSourcePreview(dataSource, table, limit)
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setColumns(result.columns);
      })
      .catch((err) => {
        if (!active) return;
        setRows([]);
        setColumns([]);
        setError(err instanceof Error ? err.message : "Failed to load preview data");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dataSource, limit, open, table]);

  const tableName = useMemo(() => {
    if (!table) return "";
    return table.schema ? `${table.schema}.${table.name}` : table.name;
  }, [table]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="source-preview-dialog max-h-[80vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{`Preview: ${tableName}`}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading preview data...
          </div>
        ) : null}
        {!loading && error ? <div className="text-sm text-destructive">{error}</div> : null}
        {!loading && !error && rows.length === 0 ? <div className="text-sm text-muted-foreground">No preview rows returned.</div> : null}
        {!loading && !error && rows.length > 0 ? (
          <div className="source-preview-dialog__table-wrap max-h-[60vh] overflow-auto rounded-md">
            <Table className="source-preview-dialog__table">
              <TableHeader className="source-preview-dialog__thead sticky top-0 z-10">
                <TableRow className="source-preview-dialog__head-row">
                  {columns.map((column) => (
                    <TableHead key={column} className="source-preview-dialog__th h-10 font-semibold text-foreground">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={`preview-row-${idx}`} className="source-preview-dialog__row">
                    {columns.map((column) => (
                      <TableCell key={`${idx}-${column}`} className="source-preview-dialog__td">
                        {formatCellValue(row[column])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
