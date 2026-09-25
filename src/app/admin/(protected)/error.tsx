"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, LogOut } from "lucide-react";

import { logoutAction } from "@/app/admin/login/actions";

/**
 * Error boundary for the protected admin segment.
 *
 * A failed database read inside a page renders that page's own graceful
 * fallback; this boundary catches everything else (unexpected render
 * errors, network loss). The recovery path re-syncs auth state: sign out
 * (clearing any stale/expired session cookies) or head back to the
 * dashboard once the underlying issue clears.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle aria-hidden="true" className="size-6" />
      </span>
      <h2 className="mt-5 text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        The page could not be loaded. Your session may have expired — signing
        out and back in usually resolves it.
      </p>
      {error.digest && (
        <p className="text-muted-foreground/60 mt-2 font-mono text-xs">
          Error ID: {error.digest}
        </p>
      )}
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-medium transition-colors"
        >
          Try again
        </button>
        <Link
          href="/admin/dashboard"
          className="border-input hover:bg-accent inline-flex h-10 items-center justify-center rounded-lg border px-5 text-sm font-medium transition-colors"
        >
          Back to dashboard
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-10 items-center gap-2 rounded-lg px-5 text-sm transition-colors"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
