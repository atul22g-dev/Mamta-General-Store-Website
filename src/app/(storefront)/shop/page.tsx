import { Suspense } from "react";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ShopView } from "@/components/shop/shop-view";
import { getShopProducts } from "@/lib/supabase/catalog";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse all products at Mamta General Store.",
};

interface ShopPageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

/** The catalog loads from the database, then the interactive view takes over. */
async function ShopProducts({
  initialQuery,
  initialCategory,
}: {
  initialQuery: string;
  initialCategory: string;
}) {
  let products: Awaited<ReturnType<typeof getShopProducts>>;
  try {
    products = await getShopProducts({ limit: 200 });
  } catch {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium">The catalog is momentarily unavailable</p>
        <p className="text-muted-foreground mt-1 text-sm">Please refresh in a moment.</p>
      </div>
    );
  }
  return (
    <Suspense fallback={<ProductGridSkeleton count={8} />}>
      <ShopView products={products} initialQuery={initialQuery} initialCategory={initialCategory} />
    </Suspense>
  );
}

/**
 * Storefront catalog page. Products come from the database; search, category,
 * price and stock filtering and sorting run in the ShopView exactly as before.
 */
export default async function ShopPage({ searchParams }: ShopPageProps) {
  const { q, category } = await searchParams;

  return (
    <Container className="flex flex-1 flex-col py-12 sm:py-16">
      <SectionHeading
        eyebrow="Shop"
        title="All products"
        description="Browse everything the store has to offer."
      />
      <div className="mt-10">
        <Suspense fallback={<ProductGridSkeleton count={8} />}>
          <ShopProducts initialQuery={q ?? ""} initialCategory={category ?? ""} />
        </Suspense>
      </div>
    </Container>
  );
}
