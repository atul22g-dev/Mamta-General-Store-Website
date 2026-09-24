import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getCategoryOptions } from "@/lib/supabase/catalog";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { DatabaseErrorState } from "@/components/admin/empty-state";

export const metadata: Metadata = { title: "New product" };
export const dynamic = "force-dynamic";

/** Add-product page. Requires at least one category to exist. */
export default async function NewProductPage() {
  let categories: { id: string; name: string }[] = [];
  let dbAvailable = true;

  try {
    categories = await getCategoryOptions();
  } catch {
    dbAvailable = false;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/products"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Products
      </Link>
      <PageHeader
        title="New product"
        description="Fill in the details below. Invalid data cannot be saved."
      />

      {!dbAvailable ? (
        <div className="bg-card rounded-xl border shadow-soft">
          <DatabaseErrorState />
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-card rounded-xl border p-8 text-center shadow-soft">
          <p className="text-sm font-medium">No categories yet</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Create a category first — every product must belong to one.
          </p>
          <Link
            href="/admin/categories"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            Go to categories
          </Link>
        </div>
      ) : (
        <div className="bg-card rounded-xl border p-6 shadow-soft sm:p-8">
          <ProductForm categories={categories} />
        </div>
      )}
    </div>
  );
}
