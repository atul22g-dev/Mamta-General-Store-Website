/**
 * Database backup — full-data dumps over the Supabase Data API.
 *
 * Usage:
 *   npm run db:backup                 # one backup into backups/
 *   npm run db:backup -- --keep 30    # keep the 30 newest backup pairs
 *
 * Why not pg_dump? The database's Postgres port (5432) is not reachable from
 * app machines (firewalled); only the HTTPS API gateway responds. PostgREST
 * can read every row, so backups are taken the same way the app reads data.
 * The .sql artifact restores on any machine that CAN reach Postgres
 * (dashboard SQL editor, psql), and the .json artifact round-trips with the
 * admin Data toolbox import (Admin → Data → Import).
 *
 * Coverage: categories, products, product_images, product_sizes,
 * product_colors, orders, order_items — plus profiles (the authorization
 * table) when admin credentials are configured.
 *
 * Credentials: catalog tables are anon-readable by RLS design. orders,
 * order_items and profiles need a signed-in admin. Optionally create
 * scripts/backup.env (gitignored) with SUPABASE_BACKUP_EMAIL /
 * SUPABASE_BACKUP_PASSWORD (an ADMIN user's Supabase Auth credentials) to
 * include those tables. Without them the catalog is still backed up;
 * orders/profiles are skipped and reported.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------- env loading

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = (m[2] ?? "").trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const appEnv = { ...readEnvFile(".env"), ...process.env };
const backupEnv = readEnvFile(join("scripts", "backup.env"));

const SUPABASE_URL = appEnv.NEXT_PRIVATE_SUPABASE_URL ?? appEnv.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = appEnv.NEXT_PRIVATE_SUPABASE_ANON_KEY ?? appEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

// ------------------------------------------------------------------ CLI flags

const keepArg = process.argv.indexOf("--keep");
const keep = keepArg !== -1 ? Number(process.argv[keepArg + 1]) : 20;
if (!Number.isFinite(keep) || keep < 1) fail("--keep must be a positive number");

// ---------------------------------------------------------------- table reads

const BACKUP_TABLES = [
  "categories",
  "products",
  "product_images",
  "product_sizes",
  "product_colors",
  "orders",
  "order_items",
] as const;

type TableName = (typeof BACKUP_TABLES)[number] | "profiles";

type Row = Record<string, unknown>;

const PAGE = 500;

/**
 * Read one table in pages. Every table has an "id" primary key, so ordering
 * by it is stable across pages (offset + stable sort = no skipped/dup rows).
 */
async function readTable(
  client: SupabaseClient,
  table: TableName,
): Promise<{ rows: Row[]; skipped?: string }> {
  const rows: Row[] = [];
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .order("id", { ascending: true })
      .range(rows.length, rows.length + PAGE - 1);
    if (error) {
      if (error.code === "42501" || /row-level security/i.test(error.message)) {
        return { rows: [], skipped: "RLS denied for anonymous read" };
      }
      fail(`Failed to read ${table}: ${error.message}`);
    }
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE) return { rows };
  }
}

// ---------------------------------------------------------------- SQL writers

/** Single-quoted PostgreSQL string literal. */
function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return sqlString(JSON.stringify(value));
  return sqlString(String(value));
}

/** Union of keys across ALL rows (rows may gain columns over time). */
function columnsOf(rows: Row[]): string[] {
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
  return columns;
}

function tableToSql(table: TableName, rows: Row[]): string {
  if (rows.length === 0) return `-- ${table}: (0 rows)`;
  const columns = columnsOf(rows);
  const lines: string[] = [`-- ${table}: ${rows.length} row(s)`];
  const CHUNK = 100; // keep each statement bounded
  for (let i = 0; i < rows.length; i += CHUNK) {
    const values = rows
      .slice(i, i + CHUNK)
      .map((row) => `  (${columns.map((c) => sqlValue(row[c])).join(", ")})`)
      .join(",\n");
    lines.push(
      `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES\n${values}\nON CONFLICT DO NOTHING;`,
    );
  }
  return lines.join("\n");
}

// ------------------------------------------------------------------------ run

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    fail(
      "Supabase URL/key not found. Set NEXT_PRIVATE_SUPABASE_URL and " +
        "NEXT_PRIVATE_SUPABASE_ANON_KEY in .env (see .env.example).",
    );
  }
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const email = backupEnv.SUPABASE_BACKUP_EMAIL;
  const password = backupEnv.SUPABASE_BACKUP_PASSWORD;

  let admin = false;
  if (email && password) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) fail(`Admin sign-in failed for ${email}: ${error.message}`);
    admin = true;
    console.log(`Signed in as ${email} (admin — orders/profiles included)`);
  } else {
    console.log("No scripts/backup.env credentials — catalog tables only (anon)");
  }

  const tables: Record<string, Row[]> = {};
  const skipped: string[] = [];

  for (const table of BACKUP_TABLES) {
    const { rows, skipped: why } = await readTable(client, table);
    tables[table] = rows;
    if (why) {
      skipped.push(table);
      console.log(`  - ${table}: SKIPPED (${why})`);
    } else {
      console.log(`  - ${table}: ${rows.length} row(s)`);
    }
  }

  if (admin) {
    const { rows, skipped: why } = await readTable(client, "profiles");
    tables["profiles"] = rows;
    if (why) {
      skipped.push("profiles");
      console.log(`  - profiles: SKIPPED (${why})`);
    } else {
      console.log(`  - profiles: ${rows.length} row(s)`);
    }
  } else {
    skipped.push("profiles");
    tables["profiles"] = [];
    console.log("  - profiles: SKIPPED (requires admin credentials)");
  }

  const exportedAt = new Date().toISOString();
  const stamp = exportedAt.slice(0, 19).replace(/[:T]/g, "-");
  mkdirSync("backups", { recursive: true });

  // ---------- JSON bundle (same shape as the admin Data toolbox export) ----
  const jsonPath = join("backups", `mamta-backup-${stamp}.json`);
  const bundle = {
    format: "mamta-store-export",
    version: 1,
    exportedAt,
    tables: {
      categories: tables.categories,
      products: tables.products,
      product_images: tables.product_images,
      product_sizes: tables.product_sizes,
      product_colors: tables.product_colors,
      orders: tables.orders,
      order_items: tables.order_items,
      ...(tables.profiles.length > 0 ? { profiles: tables.profiles } : {}),
    },
  };
  writeFileSync(jsonPath, JSON.stringify(bundle, null, 2) + "\n", "utf8");

  // ---------- SQL dump ----------
  // Restore contract:
  //   * wipes ONLY business tables (profiles is never truncated — restoring
  //     must not be able to delete the admin accounts needed to operate);
  //   * re-adds missing profiles rows (no clobber: the live authorization
  //     state wins, so a stale backup cannot demote an admin);
  //   * inserts business rows in FK-dependency order, inside one transaction.
  const sqlPath = join("backups", `mamta-backup-${stamp}.sql`);
  const header = [
    "-- Mamta General Store — data backup (generated by scripts/db-backup.ts)",
    `-- Taken: ${exportedAt}`,
    `-- Source: ${SUPABASE_URL}`,
    skipped.length > 0
      ? `-- NOTE: NOT captured (no admin credentials at backup time): ${skipped.join(", ")}`
      : "-- NOTE: complete — all business tables + profiles captured.",
    "--",
    "-- Restore on a database with the schema already applied",
    "-- (supabase/schema.sql or npm run db:deploy):",
    "--   psql \"$DATABASE_URL\" -f this-file.sql",
    "--   or paste into the dashboard SQL editor.",
    "--",
    "-- profiles rows are only re-ADDED (never updated or deleted), so",
    "-- restoring cannot lock you out of the admin area.",
    "",
    "BEGIN;",
    `TRUNCATE TABLE ${BACKUP_TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`,
    "",
  ].join("\n");

  // profiles BEFORE orders: orders.userId references profiles(id).
  const sections: string[] = [];
  if (tables.profiles.length > 0) {
    sections.push(
      tableToSql("profiles", tables.profiles).replace(
        /ON CONFLICT DO NOTHING;/g,
        'ON CONFLICT ("id") DO NOTHING;',
      ),
    );
  }
  for (const table of BACKUP_TABLES) {
    sections.push(tableToSql(table, tables[table]));
  }

  const sql = header + sections.join("\n\n") + "\n\nCOMMIT;\n";
  writeFileSync(sqlPath, sql, "utf8");

  console.log(`\n✓ Backup complete:`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${sqlPath}`);
  if (skipped.length > 0) {
    console.log(`\n  ⚠ Not captured: ${skipped.join(", ")}`);
    console.log(`    Add admin credentials to scripts/backup.env (gitignored):`);
    console.log(`      SUPABASE_BACKUP_EMAIL=...`);
    console.log(`      SUPABASE_BACKUP_PASSWORD=...`);
  }

  // ---------- Retention: keep the newest `keep` backup pairs ----------
  const byStamp = new Map<string, number>();
  for (const f of readdirSync("backups")) {
    const m = f.match(/^mamta-backup-(.+)\.(json|sql)$/);
    if (!m) continue;
    const mtime = statSync(join("backups", f)).mtimeMs;
    byStamp.set(m[1], Math.max(byStamp.get(m[1]) ?? 0, mtime));
  }
  const stamps = [...byStamp.entries()].sort((a, b) => b[1] - a[1]);
  for (const [stale] of stamps.slice(keep)) {
    for (const ext of [".json", ".sql"]) {
      const p = join("backups", stale + ext);
      if (existsSync(p)) unlinkSync(p);
    }
    console.log(`  pruned old backup: ${stale}.*`);
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
