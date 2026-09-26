import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, LogOut, Store } from "lucide-react";

import { requireAdmin } from "@/lib/auth/session";
import { dbHealthDetailed } from "@/lib/supabase/health";
import { logoutAction } from "@/app/admin/login/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { DatabaseStatus } from "@/components/admin/database-status";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
}; /**
 * Supabase project host from the public env URL; null when unset or malformed.
 * A malformed NEXT_PUBLIC_SUPABASE_URL must not crash the whole admin shell —
 * the status dot already reports the connection as unhealthy in that case.
 */
function supabaseHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

/**
 * Protected shell for every /admin route. `requireAdmin` verifies the Supabase
 * Auth session server-side and authorizes against the profiles table (ADMIN +
 * active) — the authoritative gate (the proxy is only the fast first layer).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, dbStatus] = await Promise.all([requireAdmin(), dbHealthDetailed()]);
  const dbHost = supabaseHost();

  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="bg-card/95 supports-[backdrop-filter]:bg-card/80 sticky top-0 z-40 border-b backdrop-blur">
        {/* Top row: brand, desktop nav, account/logout */}
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2.5 font-semibold tracking-tight"
          >
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <Store aria-hidden="true" className="size-4" />
            </span>
            <span className="font-display text-lg">Admin</span>
          </Link>

          <AdminNav className="hidden md:flex" />

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <DatabaseStatus initial={dbStatus} host={dbHost ?? "not configured"} />
            <span className="text-muted-foreground hidden text-sm whitespace-nowrap md:inline">
              {session.name}
            </span>
            <Link
              href="/admin/change-password"
              aria-label="Change password"
              title="Change password"
              className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors md:min-h-9 md:min-w-9"
            >
              <KeyRound aria-hidden="true" className="size-4" />
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Log out"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex min-h-11 items-center gap-2 rounded-lg px-2.5 whitespace-nowrap transition-colors md:min-h-9"
              >
                <LogOut aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Log out</span>
                <span className="sr-only sm:hidden">Log out</span>
              </button>
            </form>
          </div>
        </div>

        {/* Mobile nav row: horizontally scrollable tab strip (scrollbar hidden).
            A right-edge card-colored fade hints there is more to scroll to. */}
        <div className="relative md:hidden">
          <AdminNav className="flex overflow-x-auto border-t px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" />
          <div
            aria-hidden="true"
            className="bg-linear-to-l from-card pointer-events-none absolute inset-y-0 right-0 w-8 to-transparent"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
