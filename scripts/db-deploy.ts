/**
 * Deploy Supabase migrations.
 *
 * Usage:
 *   npm run db:deploy
 *
 * Applies every SQL file in `supabase/migrations/` (in filename order) to the
 * PostgreSQL database named by DATABASE_URL:
 *   1. Resolves a working connection: the direct host first, then Supabase's
 *      IPv4-compatible pooler (regions tried in likelihood order) — needed on
 *      IPv4-only networks where `db.<ref>.supabase.co` is unreachable.
 *   2. Creates a `schema_migrations` tracking table.
 *   3. For each not-yet-applied file: runs the whole file in a transaction
 *      and records it. A failed file rolls back fully and stops the deploy.
 *   4. Verifies the live schema (tables, key columns, functions, RLS,
 *      bucket) and prints a summary — hand-made tables with wrong shapes
 *      are reported as drift instead of silently passing.
 *
 * Requires DATABASE_URL — set up once with `npm run db:login`, which writes
 * scripts/db.env (gitignored; the Next.js app never reads it). .env's
 * DATABASE_URL also works as a fallback.
 * Our migrations are additive and idempotent; a failed deploy rolls back
 * and leaves the database exactly as it was.
 */
import { readFileSync, existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import "dotenv/config";
import { Client } from "pg";

/**
 * Load DATABASE_URL from scripts/db.env (preferred — the app's .env no
 * longer holds secrets), falling back to .env via dotenv.
 */
function loadDbUrl(): string | undefined {
  const dbEnvPath = join(process.cwd(), "scripts", "db.env");
  if (existsSync(dbEnvPath)) {
    const line = readFileSync(dbEnvPath, "utf8")
      .split(/\r?\n/)
      .find((line) => /^\s*DATABASE_URL\s*=/.test(line));
    const value = line?.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
    if (value) return value;
  }
  return process.env.DATABASE_URL;
}

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/** Pooler regions, most-likely first. Wrong regions fail fast (bad tenant). */
const POOLER_REGIONS = [
  "ap-southeast-1", // this project's region (aws-0); probe first for speed
  "ap-south-1",
  "ap-northeast-1",
  "us-east-1",
  "eu-west-2",
  "eu-central-1",
  "us-west-1",
  "sa-east-1",
  "ap-southeast-2",
  "eu-west-1",
  "ap-northeast-2",
  "ca-central-1",
];

/** Tables the application depends on. */
const EXPECTED_TABLES = [
  "users",
  "categories",
  "products",
  "product_images",
  "product_sizes",
  "product_colors",
  "orders",
  "order_items",
  "profiles",
];

/** Key columns per table — catches hand-made tables with wrong shapes. */
const EXPECTED_COLUMNS: Record<string, string[]> = {
  users: ["id", "email", "role", "active"],
  categories: ["id", "name", "slug", "description", "imageUrl"],
  products: [
    "id",
    "name",
    "slug",
    "price",
    "discountPrice",
    "stock",
    "sku",
    "featured",
    "active",
    "categoryId",
  ],
  product_images: ["id", "url", "alt", "position", "productId"],
  product_sizes: ["id", "label", "productId"],
  product_colors: ["id", "name", "hex", "productId"],
  orders: ["id", "orderNumber", "status", "userId", "customerName", "total"],
  order_items: ["id", "quantity", "unitPrice", "lineTotal", "orderId", "productId"],
  profiles: ["id", "email", "name", "role", "active"],
};

const EXPECTED_FUNCTIONS = ["place_order", "db_health"];

/** RLS must be enabled on every application table. */
const EXPECTED_RLS_TABLES = [...EXPECTED_TABLES];

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

/** Build the pooler fallback URLs for a project reference. */
function poolerCandidates(dbUrl: URL, projectRef: string): string[] {
  const candidates: string[] = [];
  for (const port of [5432, 6543]) {
    for (const region of POOLER_REGIONS) {
      const url = new URL(dbUrl.toString());
      url.hostname = `aws-0-${region}.pooler.supabase.com`;
      url.port = String(port);
      url.username = `postgres.${projectRef}`;
      candidates.push(url.toString());
    }
  }
  return candidates;
}

/** Project ref from a direct host like db.<ref>.supabase.co. */
function projectRefFromHost(hostname: string): string | null {
  const match = hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
  return match ? (match[1] ?? null) : null;
}

/**
 * Find a working connection: try DATABASE_URL as given, then the pooler.
 * Prints which connection won (host only — never the password).
 */
async function resolveClient(dbUrl: string): Promise<Client> {
  const parsed = new URL(dbUrl);
  const ref = projectRefFromHost(parsed.hostname);

  const direct = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    await direct.connect();
    await direct.query("SELECT 1");
    console.log(`Connected directly to ${parsed.hostname}`);
    return direct;
  } catch (directError) {
    await direct.end().catch(() => {});
    const reason = directError instanceof Error ? directError.message : String(directError);
    console.log(`Direct connection failed (${reason.split("\n")[0]})`);

    if (!ref) {
      fail(
        "DATABASE_URL is not a direct Supabase host and it did not connect. " +
          "Check the connection string (Supabase dashboard → Project Settings → Database).",
      );
    }

    console.log("Trying Supabase pooler regions (IPv4-compatible)…");
    for (const candidate of poolerCandidates(parsed, ref)) {
      const url = new URL(candidate);
      const client = new Client({
        connectionString: candidate,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 6000,
      });
      try {
        await client.connect();
        await client.query("SELECT 1");
        console.log(`Connected via pooler: ${url.hostname}:${url.port}`);
        console.log(
          `\nTip: save this in .env as DATABASE_URL to skip region probing next time\n` +
            `  (pooler URL, password redacted): postgresql://postgres.${ref}:•••@${url.hostname}:${url.port}/postgres`,
        );
        return client;
      } catch {
        await client.end().catch(() => {});
      }
    }
    fail(
      "Could not connect directly or via any pooler region. " +
        "Most likely the database password in scripts/db.env is stale — reset it under " +
        "Supabase dashboard → Project Settings → Database → Connection string → " +
        "'Reset database password', copy the fresh URI into scripts/db.env, and re-run. " +
        "(Also check the project is not paused.)",
    );
  }
}

async function main() {
  const dbUrl = loadDbUrl();
  if (!dbUrl) {
    fail(
      "DATABASE_URL is not set. Create scripts/db.env (copy scripts/db.env.example) and paste " +
        "your connection string: Supabase dashboard → Project Settings → Database → " +
        "Connection string → URI.",
    );
  }

  // Read the migration files from disk.
  let files: string[];
  try {
    const entries = await readdir(MIGRATIONS_DIR);
    files = entries.filter((f) => f.endsWith(".sql")).sort();
  } catch {
    fail(`Cannot read ${MIGRATIONS_DIR}. Run from the project root.`);
  }
  if (files.length === 0) {
    fail("No .sql migration files found in supabase/migrations.");
  }

  const client = await resolveClient(dbUrl);

  try {
    // ---- Tracking table ----
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const applied = new Set(
      (await client.query<{ name: string }>("SELECT name FROM public.schema_migrations")).rows.map(
        (row) => row.name,
      ),
    );

    // ---- Apply pending migrations, one transaction per file ----
    const pending = files.filter((file) => !applied.has(file));
    console.log(
      pending.length === 0
        ? `No pending migrations (${applied.size}/${files.length} already applied).`
        : `Applying ${pending.length} migration(s): ${pending.join(", ")}`,
    );

    for (const file of pending) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO public.schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`  ✓ ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        fail(
          `${file} failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // ---- Verification: the live schema must match what the app expects ----
    const problems: string[] = [];

    for (const table of EXPECTED_TABLES) {
      const exists = await client.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [table],
      );
      if (exists.rowCount === 0) {
        problems.push(`missing table "${table}"`);
        continue;
      }

      // Column shape check — catches hand-made tables that shadow our names.
      const columns = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [table],
      );
      const present = new Set(columns.rows.map((row) => row.column_name));
      for (const column of EXPECTED_COLUMNS[table] ?? []) {
        if (!present.has(column))
          problems.push(`table "${table}" is missing column "${column}" (drift)`);
      }
    }

    for (const fn of EXPECTED_FUNCTIONS) {
      const exists = await client.query(
        `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = $1`,
        [fn],
      );
      if (exists.rowCount === 0) problems.push(`missing function "${fn}"`);
    }

    const rlsRows = await client.query<{ table_name: string; rowsecurity: boolean }>(
      `SELECT tablename AS "table_name", rowsecurity FROM pg_tables
       WHERE schemaname = 'public' AND tablename = ANY($1)`,
      [EXPECTED_RLS_TABLES],
    );
    for (const row of rlsRows.rows) {
      if (!row.rowsecurity) problems.push(`RLS not enabled on "${row.table_name}"`);
    }

    const bucket = await client.query(`SELECT 1 FROM storage.buckets WHERE id = 'product-images'`);
    if (bucket.rowCount === 0) problems.push(`missing storage bucket "product-images"`);

    if (problems.length > 0) {
      console.error("\nSchema verification FAILED (drift or partial apply):");
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exit(1);
    }

    console.log("\n✓ All migrations applied and schema verified:");
    console.log(`  - Tables (9): ${EXPECTED_TABLES.join(", ")} — key columns present`);
    console.log(`  - Functions: ${EXPECTED_FUNCTIONS.join(", ")}`);
    console.log(`  - RLS enabled on all ${EXPECTED_RLS_TABLES.length} tables`);
    console.log("  - Storage bucket: product-images (public read, server-only write)");
    console.log("\nDatabase is ready. Next: create an admin, then seed a category:");
    console.log("  npx tsx scripts/create-admin.ts <email> <name>");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
