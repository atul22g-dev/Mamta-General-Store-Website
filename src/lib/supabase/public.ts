import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Public Supabase client — server-side, keyed with the anon key.
 *
 * Every request runs under Row Level Security: the storefront's public
 * catalog reads (products, categories, images, variants) are allowed by
 * public-read policies (migration 0007), and nothing else is reachable.
 * There is no session: this is the same privilege level as a visitor.
 *
 * Singleton: the client holds no per-request state.
 */
let publicClient: ReturnType<typeof createClient> | null = null;

export function getSupabasePublicClient() {
  if (!publicClient) {
    publicClient = createClient(supabaseUrl(), supabaseAnonKey(), {
      auth: {
        // No user session is used here — pure public reads.
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return publicClient;
}
