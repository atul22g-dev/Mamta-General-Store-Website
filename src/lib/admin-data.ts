import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Data export — full-fidelity JSON snapshots of every business table.
 *
 * All queries run through the session-scoped admin client (RLS `is_admin()`
 * policies authorize the reads; there is no service-role key in this app).
 * Rows are raw column maps: export/import stay lossless even when the UI
 * layer's domain types evolve, and re-importing an export round-trips
 * exactly.
 *
 * Write-heavy tables (orders/order_items) are read in pages to keep memory
 * bounded as history grows. Catalog tables are small and read in full.
 */

/** Column maps exactly as stored in Postgres (camelCase, quoted columns). */
export type ExportRow = Record<string, unknown>;

export interface ExportBundle {
  /** Schema/version marker for future format evolution. */
  format: "mamta-store-export";
  version: 1;
  /** ISO timestamp of the export. */
  exportedAt: string;
  tables: {
    categories: ExportRow[];
    products: ExportRow[];
    product_images: ExportRow[];
    product_sizes: ExportRow[];
    product_colors: ExportRow[];
    orders: ExportRow[];
    order_items: ExportRow[];
  };
}

/** Page size for paginated reads (orders grow unboundedly). */
const PAGE_SIZE = 500;

/** Read a small table in full. */
async function readAll(table: keyof ExportBundle["tables"], order: string): Promise<ExportRow[]> {
  const client = await getSupabaseAdminClient();
  const { data, error } = await client.from(table).select("*").order(order);
  if (error) throw new Error(`Failed to export ${table}: ${error.message}`);
  return (data ?? []) as ExportRow[];
}

/**
 * Read a possibly-large table in stable pages. `orders` sorts by createdAt;
 * `order_items` has no timestamp column (child rows, stable join order via
 * the parent's createdAt), so it pages by its own id for a deterministic
 * cursor.
 */
async function readPaged(table: "orders" | "order_items"): Promise<ExportRow[]> {
  const client = await getSupabaseAdminClient();
  const orderColumn = table === "orders" ? "createdAt" : "id";
  const rows: ExportRow[] = [];
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .order(orderColumn, { ascending: true })
      .range(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to export ${table}: ${error.message}`);
    const page = (data ?? []) as ExportRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** Build a complete export bundle. Throws on any table read failure. */
export async function buildExportBundle(): Promise<ExportBundle> {
  return {
    format: "mamta-store-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      categories: await readAll("categories", "createdAt"),
      products: await readAll("products", "createdAt"),
      product_images: await readAll("product_images", "position"),
      product_sizes: await readAll("product_sizes", "label"),
      product_colors: await readAll("product_colors", "name"),
      orders: await readPaged("orders"),
      order_items: await readPaged("order_items"),
    },
  };
}

/** Escape a value for CSV: quote when needed, double embedded quotes. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Convert rows to RFC 4180 CSV using the union of keys (first-seen order)
 * as columns. For multi-table CSVs we produce one file per table, so
 * callers pass a single table's rows.
 */
export function rowsToCsv(rows: ExportRow[]): string {
  if (rows.length === 0) return "";
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(row[c])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
