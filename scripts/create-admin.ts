/**
 * Create (or promote) an admin.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts <email> <name>
 *
 * Prompts for a password (hidden input) and provisions:
 *   1. A Supabase Auth user (email confirmed, password set)
 *   2. A linked `profiles` row with role ADMIN, active
 *
 * Creating Auth users requires the service-role key. This app intentionally
 * ships WITHOUT it in .env (nothing privileged is stored server-side), so
 * there are two supported paths:
 *
 *   A. Run with a temporary key, without saving it anywhere:
 *        SUPABASE_SERVICE_ROLE_KEY=sb_secret_… npx tsx scripts/create-admin.ts <email> <name>
 *   B. Dashboard only (no key ever touches this machine):
 *        Supabase dashboard → Authentication → Users → Add user
 *          (email + password, "Auto Confirm User" on)
 *        then SQL Editor:
 *          insert into profiles (id, email, name, role, active)
 *          select id, '<email>', '<name>', 'ADMIN', true from auth.users
 *          where email = '<email>';
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const DASHBOARD_STEPS = `
No service-role key found — running without one is fine. Create the admin in
the Supabase dashboard instead:

  1. Supabase dashboard → Authentication → Users → "Add user"
       • email + password, and switch "Auto Confirm User" ON
  2. Supabase dashboard → SQL Editor → run:

       insert into profiles (id, email, name, role, active)
       select id, '<EMAIL>', '<NAME>', 'ADMIN', true
       from auth.users where email = '<EMAIL>';

  3. Sign in at /admin/login with that email and password.

(Prefer the script? Put the key in scripts/admin.env — see step 4 — and re-run "npm run create-admin".)
`;

async function readPassword(): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const password = await rl.question("Password (min 8 chars): ");
  rl.close();
  if (!password || password.length < 8) {
    console.error("Error: password must be at least 8 characters.");
    process.exit(1);
  }
  return password;
}

async function main() {
  const emailArg = process.argv[2];
  const nameArg = process.argv[3];
  if (!emailArg || !nameArg) {
    console.error(
      "Usage: npm run create-admin -- <email> <name>\n" +
        "       npx tsx scripts/create-admin.ts <email> <name>",
    );
    process.exit(1);
  }
  const email = emailArg.toLowerCase();
  const name = nameArg;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  // The key may come from the environment (any shell) or scripts/admin.env —
  // a gitignored one-line file, so Windows/PowerShell users need no special
  // env-var syntax.
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEnvPath = join(process.cwd(), "scripts", "admin.env");
  if (!serviceRoleKey && existsSync(adminEnvPath)) {
    const line = readFileSync(adminEnvPath, "utf8")
      .split(/\r?\n/)
      .find((line) => /^\s*SUPABASE_SERVICE_ROLE_KEY\s*=/.test(line));
    const value = line?.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
    if (value) serviceRoleKey = value;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.log(
      DASHBOARD_STEPS.replace(/<EMAIL>/g, email).replace(/<NAME>/g, name) +
        "\n  4. scripts/admin.env — one line, gitignored:\n" +
        "       SUPABASE_SERVICE_ROLE_KEY=sb_secret_…\n",
    );
    return;
  }
  if (serviceRoleKey.startsWith("sb_publishable_") || serviceRoleKey.startsWith("eyJ")) {
    console.error(
      "Error: SUPABASE_SERVICE_ROLE_KEY holds a publishable/anon key (sb_publishable_…), " +
        "which the Auth-admin API rejects.\n" +
        "Fix: Supabase dashboard → Project Settings → API → Secret keys → copy the sb_secret_… " +
        "key, then re-run this script with it.",
    );
    process.exit(1);
  }

  // Service-role client: server-side provisioning only, RLS bypassed.
  // The key is read from the environment for this invocation only.
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const password = await readPassword();

    // 1. Create (or fetch) the Auth user.
    let authUserId: string;
    const { data: existing } = await supabase.auth.admin.listUsers();
    const existingUser = existing?.users?.find((user) => user.email?.toLowerCase() === email);

    if (existingUser) {
      authUserId = existingUser.id;
      const { error } = await supabase.auth.admin.updateUserById(authUserId, {
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (error) throw error;
    } else {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (error) throw error;
      if (!created.user) throw new Error("Auth user creation returned no user.");
      authUserId = created.user.id;
    }

    // 2. Upsert the linked ADMIN profile (authorization lives here).
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: authUserId, email, name, role: "ADMIN", active: true }, { onConflict: "id" });
    if (profileError) throw profileError;

    console.log(`Admin ready: ${email} (ADMIN) — auth user ${authUserId}`);
  } finally {
    // No persistent resources to close; kept for symmetry with future steps.
  }
}

main().catch((error) => {
  console.error("Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
