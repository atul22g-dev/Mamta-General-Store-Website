import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { findCategoryBySlug } from "@/config/categories";
import { getShopProducts, getCategoriesWithCounts } from "@/lib/supabase/catalog";
import { buttonVariants } from "@/components/ui/button-variants";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ShopView } from "@/components/shop/shop-view";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { cn } from "@/lib/utils";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = findCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };

  return {
    title: category.name,
    description: `Browse the ${category.name.toLowerCase()} collection at Mamta General Store. ${category.description}`,
  };
}

/** Category products + all categories with counts, from the database. */
async function CategoryProducts({ slug }: { slug: string }) {
  let products: Awaited<ReturnType<typeof getShopProducts>>;
  let categories: Awaited<ReturnType<typeof getCategoriesWithCounts>>;

  try {
    [products, categories] = await Promise.all([
      getShopProducts({ categories: [slug], limit: 200 }),
      getCategoriesWithCounts(),
    ]);
  } catch {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium">The catalog is momentarily unavailable</p>
        <p className="text-muted-foreground mt-1 text-sm">Please refresh in a moment.</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium">No products in this collection yet</p>
        <p className="text-muted-foreground mt-1 text-sm">
          New arrivals are being prepared — check back soon.
        </p>
        <Link href="/shop" className={cn(buttonVariants({ variant: "outline" }), "mt-6")}>
          Browse all products
        </Link>
      </div>
    );
  }

  return (
    <Suspense fallback={<ProductGridSkeleton count={8} />}>
      <ShopView
        products={products}
        categories={categories.map(({ id, name, slug: categorySlug }) => ({
          id,
          name,
          slug: categorySlug,
        }))}
        initialCategory={slug}
      />
    </Suspense>
  );
}

/**
 * Data-driven category page: lists live products from the database for any
 * category slug. Registry config supplies presentation metadata; adding a
 * category needs no route or code changes.
 */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = findCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <div className="flex flex-1 animate-fade-up flex-col">
      <Container className="flex flex-1 flex-col py-12 sm:py-16">
        <SectionHeading
          align="center"
          eyebrow="Collection"
          title={category.name}
          description={category.description}
        />
        <div className="mt-10">
          <Suspense fallback={<ProductGridSkeleton count={8} />}>
            <CategoryProducts slug={slug} />
          </Suspense>
        </div>
      </Container>
    </div>
  );
}
