import type { Metadata } from "next";

import { ChangePasswordForm } from "./change-password-form";
import { PageHeader } from "@/components/admin/page-header";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Change password" };
export const dynamic = "force-dynamic";

/** Change the signed-in admin's own password. */
export default function ChangePasswordPage() {
  return (
    <Container className="py-8">
      <PageHeader
        title="Change password"
        description="Update the password for your admin account."
      />
      <div className="bg-card max-w-md rounded-xl border p-6 shadow-soft sm:p-8">
        <ChangePasswordForm />
      </div>
    </Container>
  );
}
