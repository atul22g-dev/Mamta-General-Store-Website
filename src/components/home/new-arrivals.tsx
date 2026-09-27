import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Suspense } from "react";

import { getNewArrivals } from "@/lib/supabase/catalog";
import { buttonVariants } from "@/components/ui/button-variants";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { cn } from "@/lib/utils";

/**
 * "New Arrivals" — recently added products, streamed from the database
 * behind a skeleton.
 */
async function NewArrivalsGrid() {
  let products: Awaited<ReturnType<typeof getNewArrivals>>;
  try {
    products = await getNewArrivals(4);
  } catch {
    // Database unreachable — the band degrades quietly instead of erroring.
    return null;
  }

  if (products.length === 0) return null;

  return <ProductGrid products={products} className="mt-10" />;
}

export function NewArrivals() {
  return (
    <section className="py-16 sm:py-20" aria-labelledby="new-arrivals-heading">
      <Container>
        <SectionHeading
          eyebrow="Just in"
          title="New Arrivals"
          description="Discover recently added products and seasonal essentials at Mamta General Store."
          action={
            <Link href="/shop" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              View all
              <ArrowRight />
            </Link>
          }
        />
        <Suspense fallback={<ProductGridSkeleton count={4} className="mt-10" />}>
          <NewArrivalsGrid />
        </Suspense>
      </Container>
    </section>
  );
}
