/**
 * Set up scripts/db.env (the maintenance database connection) in one step.
 *
 * Usage:
 *   npm run db:login
 *
 * What it does:
 *   1. Reads the project ref from NEXT_PUBLIC_SUPABASE_URL in .env —
 *      no copy-pasting hosts or project refs.
 *   2. Asks for the database password (typed characters stay hidden).
 *   3. Verifies the connection, then writes scripts/db.env with the
 *      IPv4-friendly session-pooler URL (region auto-detected by probing).
 *
 * The password comes from the Supabase dashboard
 * (Project Settings → Database → Reset database password). It is stored
 * locally in scripts/db.env (gitignored) and never printed.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { stdin, stdout } from "node:process";

import "dotenv/config";
import { Client } from "pg";

const PROJECT_REF = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
  const match = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (!match?.[1]) {
    console.error(
      "Could not read the project ref from NEXT_PUBLIC_SUPABASE_URL in .env. " +
        "Fix that variable first (Supabase dashboard → Project Settings → General).",
    );
    process.exit(1);
  }
  return match[1].toLowerCase();
})();

const DB_ENV_PATH = join(process.cwd(), "scripts", "db.env");
/** Regions probed in order; the first tenant match wins. */
const REGIONS = ["ap-southeast-1", "ap-south-1", "us-east-1", "eu-west-2", "eu-central-1"];

/**
 * Read a password without echoing it: the prompt stays visible (written
 * straight to stdout), only the typed characters are suppressed. Works in
 * PowerShell, Windows Terminal, bash — and when stdin is piped.
 */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    stdout.write(question);
    const chars: string[] = [];
    const wasRaw = stdin.isRaw;
    const isTTY = stdin.isTTY === true;
    if (isTTY) stdin.setRawMode(true);
    stdin.resume();

    const cleanup = () => {
      stdin.removeListener("data", onData);
      if (isTTY) stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
      stdout.write("\n");
    };
    const onData = (chunk: Buffer) => {
      const input = chunk.toString("utf8");
      for (const char of input) {
        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(chars.join(""));
          return;
        }
        if (char === "\u0003") process.exit(1); // Ctrl+C
        if (char === "\u007f" || char === "\b") chars.pop();
        else chars.push(char);
      }
    };
    stdin.on("data", onData);
  });
}

/** True when this pooler host accepts the tenant (validates ref + region). */
async function tenantExists(host: string): Promise<boolean> {
  const client = new Client({
    host,
    port: 5432,
    user: `postgres.${PROJECT_REF}`,
    password: "probe-only",
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 6000,
  });
  try {
    await client.connect();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // "tenant not found" → wrong region; auth errors → right region.
    return !/tenant/i.test(message);
  } finally {
    await client.end().catch(() => {});
  }
}

async function main(): Promise<void> {
  console.log(`\nSetting up scripts/db.env for project ${PROJECT_REF}\n`);

  console.log("Detecting your project's pooler region…");
  let host: string | null = null;
  for (const region of REGIONS) {
    const candidate = `aws-0-${region}.pooler.supabase.com`;
    process.stdout.write(`  ${candidate} … `);
    if (await tenantExists(candidate)) {
      console.log("OK");
      host = candidate;
      break;
    }
    console.log("no");
  }
  if (!host) {
    console.error("\nNo pooler region matched this project ref. Is the project active?");
    process.exit(1);
  }
  console.log(`\nUsing pooler: ${host} (works on IPv4-only networks)\n`);

  console.log(
    "Get your database password:\n" +
      "  Supabase dashboard → Project Settings → Database → Connection string\n" +
      '  → "Reset database password" (the old one cannot be recovered).\n',
  );
  // Password may be passed as an argument (npm run db:login -- "mypassword")
  // for shells/environments where hidden interactive input is awkward.
  const argPassword = process.argv[2];
  const password =
    argPassword ??
    (await askHidden("Database password (typing is hidden, press Enter when done): "));
  if (!password) {
    console.error("\nNo password entered — nothing written. Run `npm run db:login` again.");
    process.exit(1);
  }

  const url = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(password)}@${host}:5432/postgres`;

  // Validate before writing: a wrong password should fail here, not at deploy.
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query("SELECT 1");
  } catch (error) {
    console.error(
      `\n✗ That password did not work (${error instanceof Error ? error.message.split("\n")[0] : "connection failed"}).\n` +
        "  Nothing was written. Reset the password in the dashboard and run again.",
    );
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }

  const banner =
    "# Generated by `npm run db:login` — maintenance scripts only.\n" +
    "# The Next.js app never reads this file (it is gitignored).\n";
  writeFileSync(DB_ENV_PATH, `${banner}DATABASE_URL="${url}"\n`);
  console.log(`\n✓ Connection verified and saved to scripts/db.env (gitignored).`);
  console.log("  Next: npm run db:deploy");
}

main();
