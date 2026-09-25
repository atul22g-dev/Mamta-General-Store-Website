import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Admin-capable Supabase client — **per-request, session-scoped**.
 *
 * Runs with the anon key under the **signed-in admin's identity**: writes are
 * authorized by the RLS admin policies (`is_admin()` — profiles.role='ADMIN',
 * active) in migration 0007. There is no service-role key in this app.
 *
 * Callers are server components/actions that already gate on
 * `getAdminSession()`; the database enforces the same rule as a backstop, so
 * a forged or stolen session gains nothing beyond its own profile.
 *
 * A fresh client is created per call (cookie mutations are request-scoped);
 * cookie writes are ignored during Server Component renders, where the
 * browser client refreshes the token instead.
 */
export async function getSupabaseAdminClient() {
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
