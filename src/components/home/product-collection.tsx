import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getShopProducts } from "@/lib/supabase/catalog";
import type { Product } from "@/types/product";
import { buttonVariants } from "@/components/ui/button-variants";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductCard } from "@/components/product/product-card";
import { cn } from "@/lib/utils";

/**
 * "Product Collection" — the full dress-material range, straight from the
 * database (newest first). Degrades gracefully while the catalog is empty.
 */
export async function ProductCollection() {
  let products: Product[] = [];
  let failed = false;
  try {
    products = await getShopProducts({ sort: "newest", limit: 12 });
  } catch {
    failed = true;
  }

  return (
    <section className="py-16 sm:py-20" aria-labelledby="collection-heading">
      <Container>
        <SectionHeading
          eyebrow="The range"
          title="Product Collection"
          description="Every dress material in the shop — cottons, prints and festive sets."
          action={
            products.length > 0 ? (
              <Link href="/shop" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                View all
                <ArrowRight />
              </Link>
            ) : undefined
          }
        />

        {products.length > 0 ? (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="border-border mt-10 rounded-xl border border-dashed py-14 text-center">
            <p className="font-display text-lg font-medium">
              {failed ? "Collection temporarily unavailable" : "New dress materials arriving soon"}
            </p>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
              {failed
                ? "Please check back shortly — the shelves are being restocked."
                : "Visit the shop or check back shortly — fresh stock is added regularly."}
            </p>
          </div>
        )}
      </Container>
    </section>
  );
}
