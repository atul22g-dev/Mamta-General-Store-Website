import type { Metadata } from "next";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = { title: "Admin Login" };

/**
 * Loading state for the login page: it resolves the session server-side
 * (already-signed-in admins are bounced to the dashboard), so a slow auth
 * check must not flash an empty screen that then jumps to the form.
 */
export default function AdminLoginLoading() {
  return (
    <main
      className="bg-background flex min-h-svh flex-col items-center justify-center px-4 py-12"
      role="status"
      aria-label="Loading"
    >
      <Loader2 aria-hidden="true" className="text-muted-foreground size-6 animate-spin" />
    </main>
  );
}
