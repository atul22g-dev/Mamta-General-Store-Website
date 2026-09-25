import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, LogOut, Store } from "lucide-react";

import { requireAdmin } from "@/lib/auth/session";
import { logoutAction } from "@/app/admin/login/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { DatabaseStatus } from "@/components/admin/database-status";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

/**
 * Protected shell for every /admin route. `requireAdmin` verifies the Supabase
 * Auth session server-side and authorizes against the profiles table (ADMIN +
 * active) — the authoritative gate (the proxy is only the fast first layer).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

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

          <div className="flex items-center gap-3">
            <DatabaseStatus />
            <span className="text-muted-foreground hidden text-sm sm:inline">{session.name}</span>
            <Link
              href="/admin/change-password"
              className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <KeyRound aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Password</span>
              <span className="sr-only sm:hidden">Change password</span>
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
              >
                <LogOut aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Log out</span>
                <span className="sr-only sm:hidden">Log out</span>
              </button>
            </form>
          </div>
        </div>

        {/* Mobile nav row: horizontally scrollable tab strip (scrollbar hidden) */}
        <AdminNav className="flex overflow-x-auto border-t px-2 pb-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden" />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
