import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { listAdminProducts } from "@/lib/admin-products";
import { getCategoryOptions } from "@/lib/supabase/catalog";
import { PageHeader } from "@/components/admin/page-header";
import { ProductFilters } from "@/components/admin/product-filters";
import { AdminProductList } from "@/components/admin/product-table";
import { DatabaseErrorState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/** Current URL filter values, normalized. */
function parseFilters(params: Record<string, string | undefined>) {
  return {
    query: params.q?.trim() || undefined,
    categoryId: params.category || undefined,
    status: (params.status as "all" | "active" | "inactive") || "all",
    page: Math.max(1, Number(params.page) || 1),
    saved: params.saved === "1",
  };
}

/**
 * Admin product list. Data fetching happens at the top so the render is a
 * flat choice: database error → recovery screen, otherwise the list.
 */
export default async function AdminProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);

  let list: Awaited<ReturnType<typeof listAdminProducts>> | null = null;
  let categories: Awaited<ReturnType<typeof getCategoryOptions>> = [];
  let dbAvailable = true;

  try {
    [list, categories] = await Promise.all([
      listAdminProducts({
        query: filters.query,
        categoryId: filters.categoryId,
        status: filters.status,
        page: filters.page,
        pageSize: PAGE_SIZE,
      }),
      getCategoryOptions(),
    ]);
  } catch {
    dbAvailable = false;
  }

  const showList = dbAvailable && list !== null;

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage the catalog — search, edit, feature and organize products."
      >
        <Button asChild className="ml-auto">
          <Link href="/admin/products/new">
            <Plus aria-hidden="true" className="size-4" />
            Add product
          </Link>
        </Button>
      </PageHeader>

      {filters.saved && (
        <p
          role="status"
          className="bg-secondary text-secondary-foreground mb-4 rounded-lg px-4 py-2.5 text-sm"
        >
          Product saved.
        </p>
      )}

      {!showList || !list ? (
        <div className="bg-card rounded-xl border shadow-soft">
          <DatabaseErrorState />
        </div>
      ) : (
        <>
          <Suspense fallback={null}>
            <ProductFilters categories={categories} />
          </Suspense>

          <AdminProductList
            list={list}
            pageSize={PAGE_SIZE}
            query={filters.query}
            categoryId={filters.categoryId}
            status={filters.status}
            page={filters.page}
          />
        </>
      )}
    </div>
  );
}
