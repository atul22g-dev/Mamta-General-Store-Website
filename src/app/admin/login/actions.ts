"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";

export interface LoginActionState {
  error?: string;
}

/** Read the caller IP for rate limiting (best-effort behind proxies). */
async function getClientKey(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

/** Same-site relative redirect targets only — never redirect off-origin. */
function safeRedirectTarget(target: string | undefined): string {
  if (!target) return "/admin/dashboard";
  if (!target.startsWith("/") || target.startsWith("//")) {
    return "/admin/dashboard";
  }
  return target;
}

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirectTarget(formData.get("redirectTo")?.toString());

  // Basic presence validation — the form enforces format client-side too.
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const clientKey = await getClientKey();
  const rate = checkRateLimit(`login:${clientKey}`);
  if (!rate.allowed) {
    const minutes = Math.ceil(rate.retryAfterSeconds / 60);
    return {
      error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // Supabase Auth verifies the credentials and sets the session cookies
    // (HttpOnly) — the password itself never touches our database.
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Generic error for unknown email, wrong password, unconfirmed address —
    // never reveal which one failed.
    if (signInError || !data.user) {
      return { error: "Invalid email or password." };
    }

    // Server-side authorization: the Auth user must have an active ADMIN
    // profile. Otherwise sign the session out immediately — a valid
    // non-admin session must never linger or reach admin routes.
    // Runs under the user's own JWT — profiles_select_own allows this read.
    const { data: profile } = await (
      await getSupabaseAdminClient()
    )
      .from("profiles")
      .select("name, role, active")
      .eq("id", data.user.id)
      .maybeSingle<{ name: string; role: string; active: boolean }>();

    if (!profile || profile.role !== "ADMIN" || !profile.active) {
      await supabase.auth.signOut();
      return { error: "Invalid email or password." };
    }

    resetRateLimit(`login:${clientKey}`);
  } catch (error) {
    // Auth/database failures must not leak stack traces to the client.
    console.error("[admin-login]", error);
    return { error: "Something went wrong. Please try again." };
  }

  // Success. redirect() throws NEXT_REDIRECT as a control-flow signal — it
  // must live OUTSIDE the try/catch above, or the catch would swallow it and
  // a successful sign-in would render as "Something went wrong".
  redirect(redirectTo);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
