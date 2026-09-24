import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 *
 * - Runs with the anon key; if a Supabase Auth session cookie is present the
 *   requests act as that user (scoped by RLS), otherwise as anonymous.
 * - Cookies are read/written through Next's cookie store so auth state stays
 *   consistent between server and browser.
 *
 * Create a fresh client per request (cookie mutations are request-scoped).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — cookie writes are not
          // allowed there. The browser client refreshes the token instead;
          // safe to ignore.
        }
      },
    },
  });
}
