import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Store } from "lucide-react";

import { getAdminSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

/** Already signed in? Go straight to the dashboard. */
export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const [{ redirectTo }, session] = await Promise.all([searchParams, getAdminSession()]);

  if (session) {
    redirect("/admin/dashboard");
  }

  return (
    <main className="bg-background flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="bg-primary text-primary-foreground mb-4 flex size-12 items-center justify-center rounded-xl">
            <Store aria-hidden="true" className="size-6" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Admin sign in</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Mamta General Store — management area
          </p>
        </div>

        <div className="bg-card rounded-2xl border p-6 shadow-soft sm:p-8">
          <LoginForm redirectTo={redirectTo} />
        </div>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          Authorized staff only. All activity is logged.
        </p>
      </div>
    </main>
  );
}
