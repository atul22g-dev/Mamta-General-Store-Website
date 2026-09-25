import { Suspense } from "react";
import type { Metadata } from "next";

import { getCategories, getShopProducts } from "@/lib/supabase/catalog";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ShopView } from "@/components/shop/shop-view";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";

export const metadata: Metadata = {
  title: "Search",
  description: "Search products at Mamta General Store.",
  robots: { index: false },
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

/** Live catalog search: DB query, then the interactive view takes over. */
async function SearchResults({ query }: { query: string }) {
  let products: Awaited<ReturnType<typeof getShopProducts>>;
  try {
    products = await getShopProducts({ query, limit: 200 });
  } catch {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium">Search is momentarily unavailable</p>
        <p className="text-muted-foreground mt-1 text-sm">Please refresh in a moment.</p>
      </div>
    );
  }
  const categories = await getCategories().catch(() => []);
  return (
    <Suspense fallback={<ProductGridSkeleton count={8} />}>
      <ShopView
        products={products}
        categories={categories.map(({ id, name, slug }) => ({ id, name, slug }))}
        initialQuery={query}
      />
    </Suspense>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q ?? "";

  return (
    <Container className="flex flex-1 flex-col py-12 sm:py-16">
      <SectionHeading
        eyebrow="Search"
        title="Find products"
        description="Search the full catalog by name, fabric or collection."
      />
      <div className="mt-10">
        <Suspense fallback={<ProductGridSkeleton count={8} />}>
          <SearchResults query={query} />
        </Suspense>
      </div>
    </Container>
  );
}
