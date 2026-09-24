import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Service-role Supabase client — **server only, secret-keyed**.
 *
 * - Bypasses Row Level Security: for trusted server-side jobs only
 *   (Storage administration, auth administration, privileged writes).
 * - The key never reaches the browser: this module is "server-only" and the
 *   env var is read exclusively here.
 * - No session/cookie handling: it is an administrative client, not a user
 *   client. Use `createSupabaseServerClient` for user-scoped work.
 *
 * Singleton: the admin client holds no per-request state.
 */
let adminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdminClient() {
  if (!adminClient) {
    adminClient = createClient(supabaseUrl(), supabaseServiceRoleKey(), {
      auth: {
        // The service role is a static secret, not a user session.
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return adminClient;
}
