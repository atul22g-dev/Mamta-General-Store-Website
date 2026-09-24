import type { Product } from "@/types/product";

import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/product/product-card";

/** Responsive grid of product cards: 2-up on mobile, 4-up on desktop. */
export function ProductGrid({ products, className }: { products: Product[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4", className)}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
