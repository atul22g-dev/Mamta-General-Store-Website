import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Suspense } from "react";

import { getFeaturedProducts } from "@/lib/supabase/catalog";
import { buttonVariants } from "@/components/ui/button-variants";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { cn } from "@/lib/utils";

/**
 * "Featured Products" — handpicked favourites on a soft contrasting band.
 * Data is fetched from the database; the grid streams in behind a skeleton.
 */
async function FeaturedProductsGrid() {
  let products: Awaited<ReturnType<typeof getFeaturedProducts>>;
  try {
    products = await getFeaturedProducts(4);
  } catch {
    // Database unreachable — the band degrades quietly instead of erroring.
    return null;
  }

  if (products.length === 0) return null;

  return <ProductGrid products={products} className="mt-10" />;
}

export function FeaturedProducts() {
  return (
    <section className="border-y bg-card py-16 sm:py-20" aria-labelledby="featured-heading">
      <Container>
        <SectionHeading
          eyebrow="Handpicked"
          title="Featured Products"
          description="Favourites our customers love — chosen for fabric, fit and finish."
          action={
            <Link href="/shop" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              View all
              <ArrowRight />
            </Link>
          }
        />
        <Suspense fallback={<ProductGridSkeleton count={4} className="mt-10" />}>
          <FeaturedProductsGrid />
        </Suspense>
      </Container>
    </section>
  );
}
