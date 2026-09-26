"use server";

import { revalidatePath } from "next/cache";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildExportBundle,
  rowsToCsv,
  type ExportBundle,
  type ExportRow,
} from "@/lib/supabase/admin-data";

/**
 * Data import/export server actions (admin only).
 *
 * Every action re-asserts the admin session server-side; the RLS `is_admin()`
 * policies backstop every read and write. There is no service-role key —
 * imports run under the signed-in admin's own identity.
 *
 * Exports return the bytes in the action response; the client turns them
 * into a Blob download (server actions respond to fetches, not navigations).
 *
 * Import safety:
 * - JSON is validated structurally (format marker, version, table shape,
 *   per-row primary keys) before anything is written.
 * - "merge" upserts by primary key and never deletes.
 * - "replace" deletes all rows child-first, then inserts the bundle; products
 *   with order history are protected by the RESTRICT foreign key (the import
 *   reports the conflict instead of silently breaking orders).
 */

export interface ExportResult {
  ok?: boolean;
  /** Filename for the client-side Blob download. */
  filename?: string;
  content?: string;
  mimeType?: string;
  error?: string;
  /** Row counts per table, for the confirmation message. */
  summary?: string;
}

export interface ImportResult {
  ok?: boolean;
  message?: string;
  error?: string;
}

/** Importable table names and their primary keys. */
const TABLES = {
  categories: "id",
  products: "id",
  product_images: "id",
  product_sizes: "id",
  product_colors: "id",
  orders: "id",
  order_items: "id",
} as const;

type ImportTable = keyof typeof TABLES;

/**
 * FK-dependency tiers. Tables within one tier have no foreign keys between
 * them, so they can be read/written in parallel; tiers must run in order
 * because they DO reference each other:
 *
 *   order_items                   → orders, products
 *   product_images/sizes/colors   → products
 *   products                      → categories
 *   orders                        → profiles (outside the import)
 *
 * Deletes run tiers child-first; inserts run the same tiers reversed
 * (parents first). Reversal is safe because each tier is a valid
 * topological layer of the same dependency graph.
 */
const DELETE_TIERS: ImportTable[][] = [
  ["order_items", "product_images", "product_sizes", "product_colors"],
  ["orders", "products"],
  ["categories"],
];

/** Parent-first tiers (inserts — FK rows must exist before children). */
const INSERT_TIERS: ImportTable[][] = [...DELETE_TIERS].reverse();

/** Tables that carry an updatedAt column (child tables don't — see 0001/0014). */
const HAS_UPDATED_AT = new Set<ImportTable>(["categories", "products", "orders"]);

/** Read the admin session via the same helper every admin action uses. */
async function assertAdmin(): Promise<void> {
  const { getAdminSession } = await import("@/lib/auth/session");
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

/** Export the full dataset as a downloadable JSON bundle. */
export async function exportJsonAction(_prev: ExportResult): Promise<ExportResult> {
  void _prev;
  try {
    await assertAdmin();
    const bundle = await buildExportBundle();
    const stamp = bundle.exportedAt.slice(0, 10);
    const counts = Object.entries(bundle.tables)
      .map(([table, rows]) => `${table}: ${rows.length}`)
      .join(" · ");

    return {
      ok: true,
      filename: `mamta-store-export-${stamp}.json`,
      content: JSON.stringify(bundle, null, 2),
      mimeType: "application/json",
      summary: counts,
    };
  } catch (error) {
    console.error("[admin-data] export failed:", error);
    return { error: error instanceof Error ? error.message : "Export failed." };
  }
}

/** Export one table as CSV (spreadsheet-friendly). */
export async function exportCsvAction(
  _prev: ExportResult,
  formData: FormData,
): Promise<ExportResult> {
  void _prev;
  try {
    await assertAdmin();
    const table = String(formData.get("table") ?? "");
    if (!(table in TABLES)) return { error: "Unknown table." };

    const bundle = await buildExportBundle();
    const rows = bundle.tables[table as ImportTable];
    const stamp = bundle.exportedAt.slice(0, 10);

    return {
      ok: true,
      filename: `mamta-store-${table}-${stamp}.csv`,
      content: rows.length === 0 ? "" : rowsToCsv(rows),
      mimeType: "text/csv",
      summary: `${rows.length} row${rows.length === 1 ? "" : "s"}`,
    };
  } catch (error) {
    console.error("[admin-data] csv export failed:", error);
    return { error: error instanceof Error ? error.message : "Export failed." };
  }
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

/** Structural validation of an uploaded bundle. */
function parseBundle(
  text: string,
): { ok: true; bundle: ExportBundle; rowCount: number } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "The file is not valid JSON." };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "Unexpected file structure." };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.format !== "mamta-store-export" || obj.version !== 1) {
    return {
      ok: false,
      error: "This file is not a Mamta General Store export (unrecognized format marker).",
    };
  }
  const tables = obj.tables as Record<string, unknown> | undefined;
  if (typeof tables !== "object" || tables === null) {
    return { ok: false, error: "The file has no tables section." };
  }

  let rowCount = 0;
  const out: Record<string, ExportRow[]> = {};
  for (const [table, pk] of Object.entries(TABLES)) {
    const rows = tables[table];
    if (!Array.isArray(rows)) {
      return { ok: false, error: `Missing or invalid table: ${table}` };
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, unknown>;
      if (typeof row !== "object" || row === null || typeof row[pk] !== "string" || !row[pk]) {
        return { ok: false, error: `${table} row ${i + 1} has no valid "${pk}"` };
      }
      for (const key of Object.keys(row)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          return { ok: false, error: `${table} row ${i + 1} has a forbidden key: ${key}` };
        }
      }
    }
    rowCount += rows.length;
    out[table] = rows as ExportRow[];
  }

  return {
    ok: true,
    rowCount,
    bundle: {
      format: "mamta-store-export",
      version: 1,
      exportedAt: String(obj.exportedAt ?? ""),
      tables: out as ExportBundle["tables"],
    },
  };
}

/** Rows per write request — PostgREST payload limits keep this bounded. */
const CHUNK_SIZE = 250;

/**
 * Write one table's rows (chunked for PostgREST payload limits). Merge
 * upserts on the primary key; replace plain-inserts (the table is empty).
 * Throws with a helpful message on FK violations and anything else.
 */
async function writeTableRows(
  client: SupabaseClient,
  table: ImportTable,
  rows: ExportRow[],
  mode: "merge" | "replace",
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE).map((row) => {
      const clean: Record<string, unknown> = { ...row };
      if (mode === "merge") {
        // Updating rows must stamp updatedAt — but only on tables that have
        // the column (child tables don't; writing it would 404).
        if (HAS_UPDATED_AT.has(table)) {
          clean.updatedAt = new Date().toISOString();
        }
      } else {
        // Preserve the exported timestamps verbatim in replace mode.
        delete clean.updatedAt;
      }
      return clean;
    });

    const request =
      mode === "merge"
        ? client.from(table).upsert(chunk, { onConflict: TABLES[table], ignoreDuplicates: false })
        : client.from(table).insert(chunk);

    const { error } = await request;
    if (error) {
      if (error.code === "23503" || /foreign key/i.test(error.message)) {
        throw new Error(
          `${table}: a row references a missing parent. When importing a ` +
            `partial bundle, parents come first (categories → products → …).`,
        );
      }
      throw new Error(`Writing ${table} failed: ${error.message}`);
    }
  }
}

/**
 * Import a previously exported JSON bundle.
 * mode=merge (default): upsert by id, never delete.
 * mode=replace: wipe tables child-first, then insert. Protected by the
 * orders→products RESTRICT key — replace reports conflicts, never orphans.
 */
export async function importDataAction(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  void _prev;
  try {
    await assertAdmin();
  } catch {
    return { error: "Your session has expired — sign in again and retry." };
  }

  const file = formData.get("file");
  const mode = formData.get("mode") === "replace" ? "replace" : "merge";
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a JSON export file to import." };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { error: "File is too large (over 20 MB)." };
  }
  if (mode === "replace" && confirmation !== "REPLACE") {
    return { error: "Type REPLACE in the confirmation box to wipe current data." };
  }

  let parsed: ReturnType<typeof parseBundle>;
  try {
    parsed = parseBundle(await file.text());
  } catch {
    return { error: "The file could not be read." };
  }
  if (!parsed.ok) return { error: parsed.error };
  const { bundle, rowCount } = parsed;

  const client = await getSupabaseAdminClient();

  try {
    if (mode === "replace") {
      // Child-first clear, tier by tier. Tables within a tier share no FKs
      // and clear in parallel; tiers run in order so a parent is never
      // cleared while its children still reference it. order_items cascade
      // from orders; product children cascade from products. A product
      // referenced by an order (RESTRICT) surfaces as a clear error, keeping
      // orders intact.
      for (const tier of DELETE_TIERS) {
        const cleared = await Promise.all(
          tier.map(async (table) => {
            const { error } = await client.from(table).delete().neq(TABLES[table], "__none__");
            return { table, error };
          }),
        );
        const failed = cleared.find(({ error }) => error !== null);
        if (failed) {
          throw new Error(
            `Clearing ${failed.table} failed: ${failed.error?.message ?? "unknown error"}`,
          );
        }
      }
    }

    // Parent-first writes, tier by tier. Tables within a tier have no FKs
    // between them and upload in parallel; tiers run in order because a
    // child row can only be written once its parent rows exist. Merge
    // upserts on the primary key; replace plain-inserts (tables are empty).
    for (const tier of INSERT_TIERS) {
      await Promise.all(
        tier.map(async (table) => {
          const rows = bundle.tables[table];
          if (rows.length === 0) return;
          await writeTableRows(client, table, rows, mode);
        }),
      );
    }
  } catch (importError) {
    console.error("[admin-data] import failed:", importError);
    return {
      error:
        importError instanceof Error
          ? importError.message
          : "The import failed. Changes stop at the first error.",
    };
  }

  revalidatePath("/admin/data");
  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/dashboard");

  return {
    ok: true,
    message: `Imported ${rowCount} row${rowCount === 1 ? "" : "s"} in ${mode} mode.`,
  };
}
