import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Admin session management — Supabase Auth.
 *
 * Identity comes from the Supabase Auth session (HttpOnly, SameSite=Lax
 * cookies managed by @supabase/ssr). `auth.getUser()` verifies the JWT
 * signature and expiry server-side on every call — a client can never
 * assert its own identity.
 *
 * Authorization is always checked against the database: the authenticated
 * user must have a linked `profiles` row with role ADMIN and active=true.
 * No client-side flag is ever trusted.
 */

export interface AdminSession {
  /** Supabase Auth user id (also the profiles.id FK). */
  userId: string;
  email: string;
  /** Display name from the profile — shown in the admin shell. */
  name: string;
}

/**
 * Resolve the current admin session, or null when the caller is not an
 * authenticated, active admin. Verifies the auth token cryptographically
 * (getUser) and then authorizes via the profile row.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    const user = data?.user;

    if (error || !user) return null;

    // Server-side authorization: role must be ADMIN on an active profile.
    // Runs under the user's own JWT — profiles_select_own allows this read.
    const { data: profile } = await (
      await getSupabaseAdminClient()
    )
      .from("profiles")
      .select("name, role, active")
      .eq("id", user.id)
      .maybeSingle<{ name: string; role: string; active: boolean }>();

    if (!profile || profile.role !== "ADMIN" || !profile.active) return null;

    return {
      userId: user.id,
      email: user.email ?? "",
      name: profile.name,
    };
  } catch (error) {
    // Let Next's internal rendering signals bubble (e.g. DYNAMIC_SERVER_USAGE
    // during static prerender) — they are not auth failures.
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string"
    ) {
      throw error;
    }
    // Auth resolution failures (unconfigured project, unreachable Supabase,
    // malformed cookies) mean "no session" — fail closed, never open.
    console.error("[admin-auth] session resolution failed:", error);
    return null;
  }
}

/**
 * Authoritative in-render guard: returns the admin session or redirects to
 * `/admin/login` (preserving the destination). Use in admin layouts/pages.
 */
export async function requireAdmin(redirectTo?: string): Promise<AdminSession> {
  const session = await getAdminSession();

  if (!session) {
    const loginUrl = redirectTo
      ? `/admin/login?redirectTo=${encodeURIComponent(redirectTo)}`
      : "/admin/login";
    redirect(loginUrl);
  }

  return session;
}
