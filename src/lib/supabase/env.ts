/**
 * Supabase environment access — the single place Supabase env vars are read.
 *
 * Validation is lazy (on first use, not at import time) so commands that
 * never touch Supabase — `prisma generate`, a plain `next build` — keep
 * working before the project is configured. Every consumer gets a precise
 * error naming the missing variable and where to find its value.
 *
 * Secrets (service-role key, DB password) live only in `.env`, which is
 * gitignored. `.env.example` documents every variable with an empty value.
 *
 * Variables (all from the Supabase dashboard → Project Settings → API):
 * - NEXT_PUBLIC_SUPABASE_URL        project URL, safe for the browser
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY   public anon key, RLS-scoped
 * - SUPABASE_SERVICE_ROLE_KEY       secret; server-only, bypasses RLS
 * - SUPABASE_DB_PASSWORD            secret; only for building DATABASE_URL
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Find it in your Supabase dashboard (Project Settings → API) and add it to .env — see .env.example.`,
    );
  }
  return value;
}

/**
 * A publishable key (sb_publishable_…) is RLS-scoped and must never sit in
 * the service-role slot: server queries silently return zero rows and the
 * Auth-admin API rejects it. Catch the mix-up at the source.
 */
function requireSecretKey(name: string): string {
  const value = requireEnv(name);
  if (value.startsWith("sb_publishable_") || value.startsWith("eyJ")) {
    throw new Error(
      `${name} holds a publishable/anon key, not the secret service key. ` +
        "Supabase dashboard → Project Settings → API → Secret keys → copy the sb_secret_… key into .env.",
    );
  }
  return value;
}

/** Project URL (public, safe on the client). */
export function supabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

/** Anonymous key (public, RLS-scoped — safe on the client). */
export function supabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/**
 * Service-role key — **secret**. Bypasses Row Level Security.
 * Must only ever be used on the server (all consumers import "server-only").
 */
export function supabaseServiceRoleKey(): string {
  return requireSecretKey("SUPABASE_SERVICE_ROLE_KEY");
}
