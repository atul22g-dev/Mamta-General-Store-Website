import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getFeaturedProducts } from "@/lib/supabase/catalog";
import { buttonVariants } from "@/components/ui/button-variants";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductGrid } from "@/components/product/product-grid";
import { cn } from "@/lib/utils";

/**
 * "Featured Products" — handpicked favourites on a soft contrasting band.
 * The whole section (heading included) renders only when at least one
 * product is flagged featured in the database; with none — or while the
 * database is unreachable — the band disappears entirely instead of showing
 * an empty heading.
 */
export async function FeaturedProducts() {
  let products: Awaited<ReturnType<typeof getFeaturedProducts>>;
  try {
    products = await getFeaturedProducts(4);
  } catch {
    return null; // Database unreachable — hide the band quietly.
  }

  if (products.length === 0) return null;

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
        <ProductGrid products={products} className="mt-10" />
      </Container>
    </section>
  );
}
