"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Supabase client for Client Components.
 *
 * - Uses the public anon key: requests run with the signed-in user's identity
 *   and are scoped by Row Level Security.
 * - Sessions are stored in cookies (via @supabase/ssr), keeping auth state
 *   readable by the server and middleware/proxy.
 *
 * Create it inside components/effects as needed; this factory is cheap and
 * the underlying store is shared via cookies.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
