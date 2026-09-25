/**
 * Supabase environment access — the single place Supabase env vars are read.
 *
 * This app shares one Supabase project with the React Native/Expo app, so
 * each variable accepts either naming convention: the Next.js `NEXT_PUBLIC_*`
 * name or the Expo `EXPO_PUBLIC_*` name. Set whichever you prefer in `.env`.
 *
 * Only PUBLIC variables are used — the URL and the anon/publishable key.
 * There is no service-role key and no database password in this app: every
 * privileged operation runs under the signed-in admin's session, authorized
 * by Row Level Security policies (supabase/migrations/0007_rls_policies.sql).
 */

function requirePublicEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(
    `${names.join(" or ")} is not set. Find both values in your Supabase dashboard ` +
      "(Project Settings → API) and add them to .env — see .env.example.",
  );
}

/** Project URL (public, safe on the client). */
export function supabaseUrl(): string {
  return requirePublicEnv("NEXT_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL");
}

/**
 * Anonymous/publishable key (public, RLS-scoped — safe on the client).
 * Accepts either the Next.js or Expo variable name.
 */
export function supabaseAnonKey(): string {
  return requirePublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}
