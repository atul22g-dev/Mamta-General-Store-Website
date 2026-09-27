import { Suspense } from "react";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ShopView } from "@/components/shop/shop-view";
import { getCategories, getShopProducts } from "@/lib/supabase/catalog";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { JsonLd } from "@/components/seo/json-ld";
import { siteUrl } from "@/config/site";

export const metadata: Metadata = {
  title: "Shop All Products",
  description:
    "Browse every product at Mamta General Store, Jatwar — school supplies, stationery, bags, footwear, personal care, toys and household items. Check what's in stock.",
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "Shop All Products — Mamta General Store, Jatwar",
    description:
      "Browse every product at Mamta General Store — school supplies, stationery, bags, footwear, personal care, toys and household items.",
    type: "website",
    url: "/shop",
  },
  twitter: {
    card: "summary",
    title: "Shop All Products — Mamta General Store, Jatwar",
    description:
      "School supplies, stationery, bags, footwear, personal care, toys and household items at Mamta General Store, Jatwar.",
  },
};

interface ShopPageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

/**
 * The catalog loads from the database, then the interactive view takes over.
 * Categories load alongside products so the filter panel can list them; if
 * categories fail but products don't, filtering degrades gracefully (search,
 * price and stock filters still work — just no category checkboxes).
 */
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
  const categories = await getCategories().catch(() => []);
  return (
    <Suspense fallback={<ProductGridSkeleton count={8} />}>
      {/* ItemList of the full catalog — helps Google associate every product
          page with the shop listing without crawling each URL first. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "All products — Mamta General Store",
          itemListElement: products.slice(0, 50).map((product, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${siteUrl}/products/${product.slug}`,
            name: product.name,
          })),
        }}
      />
      <ShopView
        products={products}
        categories={categories.map(({ id, name, slug }) => ({ id, name, slug }))}
        initialQuery={initialQuery}
        initialCategory={initialCategory}
      />
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
