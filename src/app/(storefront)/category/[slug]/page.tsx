import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  getCategoryBySlug,
  getShopProducts,
  getCategoriesWithCounts,
} from "@/lib/supabase/catalog";
import { siteConfig } from "@/config/site";
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
  let category: Awaited<ReturnType<typeof getCategoryBySlug>>;
  try {
    category = await getCategoryBySlug(slug);
  } catch {
    return { title: "Category temporarily unavailable" };
  }
  if (!category) return { title: "Category not found" };

  const description = `Browse the ${category.name.toLowerCase()} collection at ${siteConfig.name}.${category.description ? ` ${category.description}` : ""}`;

  return {
    title: category.name,
    description,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: {
      title: `${category.name} — ${siteConfig.name}`,
      description,
      type: "website",
      url: `/category/${category.slug}`,
      images: category.imageUrl ? [{ url: category.imageUrl, alt: category.name }] : undefined,
    },
    twitter: {
      card: category.imageUrl ? "summary_large_image" : "summary",
      title: `${category.name} — ${siteConfig.name}`,
      description,
    },
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
 * Data-driven category page: the category and its products both come from the
 * database — adding a category in the admin panel needs no route or code
 * changes. Inactive categories resolve to null and 404 here.
 */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <div className="flex flex-1 animate-fade-up flex-col">
      <Container className="flex flex-1 flex-col py-12 sm:py-16">
        <SectionHeading
          align="center"
          eyebrow="Collection"
          title={category.name}
          description={category.description ?? undefined}
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
