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
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env (server-side only — the key
 * is never exposed to the browser).
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

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
  const [email, name] = process.argv.slice(2);

  if (!email || !name) {
    console.error("Usage: npx tsx scripts/create-admin.ts <email> <name>");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. See .env.example.",
    );
    process.exit(1);
  }
  if (serviceRoleKey.startsWith("sb_publishable_") || serviceRoleKey.startsWith("eyJ")) {
    console.error(
      "Error: SUPABASE_SERVICE_ROLE_KEY holds a publishable/anon key (sb_publishable_…), " +
        "which the Auth-admin API rejects.\n" +
        "Fix: Supabase dashboard → Project Settings → API → Secret keys → copy the sb_secret_… " +
        "key and set it as SUPABASE_SERVICE_ROLE_KEY in .env, then re-run this script.",
    );
    process.exit(1);
  }

  // Service-role client: server-side provisioning only, RLS bypassed.
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const password = await readPassword();
    const normalizedEmail = email.toLowerCase();

    // 1. Create (or fetch) the Auth user.
    let authUserId: string;
    const { data: existing } = await supabase.auth.admin.listUsers();
    const existingUser = existing?.users?.find(
      (user) => user.email?.toLowerCase() === normalizedEmail,
    );

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
        email: normalizedEmail,
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
      .upsert(
        { id: authUserId, email: normalizedEmail, name, role: "ADMIN", active: true },
        { onConflict: "id" },
      );
    if (profileError) throw profileError;

    console.log(`Admin ready: ${normalizedEmail} (ADMIN) — auth user ${authUserId}`);
  } finally {
    // No persistent resources to close; kept for symmetry with future steps.
  }
}

main().catch((error) => {
  console.error("Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
