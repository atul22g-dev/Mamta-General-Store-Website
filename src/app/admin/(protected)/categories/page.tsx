import type { Metadata } from "next";

import { listAdminCategories } from "@/lib/supabase/admin-categories";
import { CategoryManager } from "@/components/admin/category-manager";
import { DatabaseErrorState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

/** Admin category management — live rows from the shared database. */
export default async function AdminCategoriesPage() {
  let categories: Awaited<ReturnType<typeof listAdminCategories>> = [];
  let failed = false;
  try {
    categories = await listAdminCategories();
  } catch {
    failed = true;
  }

  return (
    <Container className="py-8">
      <PageHeader
        title="Categories"
        description="Categories are data, not code — new ones appear on the storefront immediately."
      />
      {failed ? (
        <div className="bg-card rounded-xl border shadow-soft">
          <DatabaseErrorState />
        </div>
      ) : (
        <div className="bg-card rounded-xl border p-6 shadow-soft sm:p-8">
          <CategoryManager categories={categories} />
        </div>
      )}
    </Container>
  );
}
