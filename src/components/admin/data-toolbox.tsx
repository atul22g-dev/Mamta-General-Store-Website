"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileJson,
  FileSpreadsheet,
  Upload,
} from "lucide-react";

import {
  exportCsvAction,
  exportJsonAction,
  importDataAction,
  type ExportResult,
  type ImportResult,
} from "@/app/admin/data/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const emptyExport: ExportResult = {};
const emptyImport: ImportResult = {};

const TABLES = [
  { value: "categories", label: "Categories" },
  { value: "products", label: "Products" },
  { value: "product_images", label: "Product images" },
  { value: "product_sizes", label: "Product sizes" },
  { value: "product_colors", label: "Product colors" },
  { value: "orders", label: "Orders" },
  { value: "order_items", label: "Order items" },
] as const;

/** Turn a successful export action result into a real file download. */
function useBlobDownload(exportState: ExportResult) {
  useEffect(() => {
    if (!exportState.ok || !exportState.content || !exportState.filename) return;
    const blob = new Blob([exportState.content], {
      type: exportState.mimeType ?? "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exportState.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [exportState]);
}

function StatusAlert({ state }: { state: { error?: string; message?: string; summary?: string } }) {
  if (state.error) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>Not completed</AlertTitle>
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state.message) {
    return (
      <Alert className="mt-4 border-emerald-600/30 text-emerald-800">
        <CheckCircle2 aria-hidden="true" className="text-emerald-600" />
        <AlertTitle>Done</AlertTitle>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

/** Card wrapper keeps the three tools visually consistent. */
function ToolCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof FileJson;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-xl border p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon aria-hidden="true" className="size-4.5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-wide uppercase">{title}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Import/export toolbox. Exports flow through server actions and are turned
 * into Blob downloads client-side; imports post a JSON file plus mode.
 */
export function DataToolbox() {
  const [exportState, exportJson, exportPending] = useActionState(exportJsonAction, emptyExport);
  const [csvState, exportCsv, csvPending] = useActionState(exportCsvAction, emptyExport);
  const [importState, importData, importPending] = useActionState(importDataAction, emptyImport);

  const [table, setTable] = React.useState<string>("products");
  const [mode, setMode] = React.useState<"merge" | "replace">("merge");
  const [confirmation, setConfirmation] = React.useState("");

  useBlobDownload(exportState);
  useBlobDownload(csvState);

  const replaceSelected = mode === "replace";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ToolCard
        icon={FileJson}
        title="Full backup (JSON)"
        description="Every table — categories, products, images, sizes, colors, orders and order items — as one restorable bundle."
      >
        <form action={exportJson}>
          <Button type="submit" disabled={exportPending} className="min-h-11 w-full sm:w-auto">
            <Download aria-hidden="true" />
            {exportPending ? "Preparing…" : "Download JSON backup"}
          </Button>
        </form>
        {exportState.summary && (
          <p className="text-muted-foreground mt-3 text-xs">{exportState.summary}</p>
        )}
        <StatusAlert state={exportState} />
      </ToolCard>

      <ToolCard
        icon={FileSpreadsheet}
        title="Single table (CSV)"
        description="One table as a spreadsheet-friendly CSV — handy for bulk-viewing or editing in Excel/Sheets."
      >
        <form action={exportCsv} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid w-full gap-2">
            <Label htmlFor="table">Table</Label>
            <Select name="table" value={table} onValueChange={setTable}>
              <SelectTrigger id="table" className="w-full">
                <SelectValue placeholder="Choose a table" />
              </SelectTrigger>
              <SelectContent>
                {TABLES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={csvPending}
            className="min-h-11 w-full shrink-0 sm:w-auto"
          >
            <Download aria-hidden="true" />
            {csvPending ? "Preparing…" : "Download CSV"}
          </Button>
        </form>
        <StatusAlert state={csvState} />
      </ToolCard>

      <div className="lg:col-span-2">
        <ToolCard
          icon={DatabaseBackup}
          title="Import (restore)"
          description="Restore a JSON backup produced by the button above. Merge updates existing rows and adds new ones; replace wipes the current data first."
        >
          <form action={importData} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="file">Backup file (JSON)</Label>
                <Input
                  id="file"
                  name="file"
                  type="file"
                  accept="application/json,.json"
                  required
                  className="file:mr-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mode">Mode</Label>
                <Select
                  name="mode"
                  value={mode}
                  onValueChange={(value) => {
                    setMode(value as "merge" | "replace");
                    setConfirmation("");
                  }}
                >
                  <SelectTrigger id="mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="merge">Merge — update & add, never delete</SelectItem>
                    <SelectItem value="replace">Replace — wipe everything first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {replaceSelected && (
              <div className={cn("border-destructive/40 bg-destructive/5 rounded-lg border p-4")}>
                <p className="text-destructive text-sm font-medium">
                  Replace deletes every product, category and order before writing.
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Products referenced by existing orders keep those orders intact (the import stops
                  with a clear error instead). This cannot be undone.
                </p>
                <div className="mt-3 max-w-xs space-y-2">
                  <Label htmlFor="confirmation">
                    Type <span className="font-mono font-semibold">REPLACE</span> to confirm
                  </Label>
                  <Input
                    id="confirmation"
                    name="confirmation"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="off"
                    placeholder="REPLACE"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={importPending || (replaceSelected && confirmation !== "REPLACE")}
              variant={replaceSelected ? "destructive" : "default"}
              className="min-h-11 w-full sm:w-auto"
            >
              <Upload aria-hidden="true" />
              {importPending ? "Importing…" : "Import data"}
            </Button>
          </form>
          <StatusAlert state={importState} />
        </ToolCard>
      </div>
    </div>
  );
}
