import Link from "next/link";

import type { Product } from "@/types/product";
import { discountPercent, isAvailable } from "@/lib/catalog";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { cn, formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ImageArea } from "@/components/ui/image-area";

/**
 * Product card — the visual backbone of every listing (home, shop, category,
 * related). Clean editorial style: image area with a discount badge, category
 * eyebrow, serif name with an underline-on-hover, tabular price row and a
 * quiet full-width view action. Server component — no client JS.
 */
export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const { name, price, discountPrice, category, images } = product;
  const image = images[0];
  const available = isAvailable(product);
  const discount = discountPercent(product);

  return (
    <article className={cn("group flex flex-col", className)}>
      <Link
        href={`/products/${product.slug}`}
        aria-label={`View ${name}`}
        className="relative block rounded-xl focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]"
      >
        <ImageArea
          className={cn(
            "transition-all duration-300 ease-gentle group-hover:shadow-soft-lg",
            !available && "opacity-80",
          )}
          ratio="3/4"
        >
          {image && (
            // Placeholder images are remote and dynamic; next/image optimization
            // will be enabled with real image configuration later.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt={image.alt ?? name}
              loading="lazy"
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-gentle group-hover:scale-[1.04]",
                !available && "grayscale-[35%] group-hover:scale-100",
              )}
            />
          )}
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {discount && (
              <Badge variant="accent" className="shadow-xs">
                {discount}% off
              </Badge>
            )}
            {!available && (
              <Badge className="bg-secondary text-secondary-foreground shadow-xs">
                Out of stock
              </Badge>
            )}
          </div>
        </ImageArea>
      </Link>

      <div className="flex flex-1 flex-col pt-3">
        <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {category.name}
        </p>
        <h3 className="mt-1 text-[15px] leading-snug font-medium">
          <Link
            href={`/products/${product.slug}`}
            className="underline-offset-2 transition-colors group-hover:underline group-hover:decoration-1"
          >
            {name}
          </Link>
        </h3>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[15px] font-semibold tabular-nums">
            {formatPrice(price, DEFAULT_CURRENCY)}
          </span>
          {discountPrice && discountPrice > price && (
            <span className="text-xs text-muted-foreground tabular-nums line-through">
              {formatPrice(discountPrice, DEFAULT_CURRENCY)}
            </span>
          )}
        </p>
      </div>

      <Link
        href={`/products/${product.slug}`}
        className="border-input hover:border-ring/60 hover:bg-accent/50 mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg border text-xs font-medium tracking-wide shadow-xs transition-colors duration-200 ease-gentle hover:text-accent-foreground md:h-9"
      >
        View product
      </Link>
    </article>
  );
}
