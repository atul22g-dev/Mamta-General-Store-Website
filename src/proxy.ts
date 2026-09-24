import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

/**
 * Edge-side gate for the admin area: unauthenticated requests to any
 * /admin route (except /admin/login) are redirected to the login page.
 *
 * This is the fast first layer only — the authoritative check happens on
 * the server in `requireAdmin` (src/lib/auth/session.ts), which verifies
 * the token cryptographically and authorizes against the profiles table.
 * A forged cookie passes the proxy but fails there.
 */

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Project not configured yet — fail closed (redirect to login), never open.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  return supabase.auth
    .getClaims()
    .then(({ data }) => {
      if (!data?.claims) {
        const loginUrl = new URL("/admin/login", request.url);
        // Preserve the destination so login can send the user back.
        loginUrl.searchParams.set("redirectTo", pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Token verified at the edge. Note: a valid Auth session alone does not
      // grant admin — requireAdmin still authorizes against profiles server-side.
      return response;
    })
    .catch(() => {
      // Verification failure (network/expired) — treat as unauthenticated.
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    });
}

export const config = {
  matcher: [
    // Everything under /admin (including /admin itself) except the login page.
    "/admin",
    "/admin/((?!login).*)",
  ],
};
