import Link from "next/link";

import type { Product } from "@/types/product";
import { discountPercent, isAvailable } from "@/lib/catalog";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { cn, formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ImageArea } from "@/components/ui/image-area";
import { SafeImage } from "@/components/product/safe-image";

/**
 * Product card — the visual backbone of every listing (home, shop, category,
 * related). Modern retail style: rounded image frame with lift-on-hover,
 * discount badge, category eyebrow, semibold name, tabular price row and a
 * full-width view action that fills with the brand tint. Server component —
 * no client JS.
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
        className="relative block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ImageArea
          className={cn(
            "border-transparent transition-all duration-300 ease-gentle group-hover:-translate-y-1 group-hover:shadow-soft-lg",
            !available && "opacity-80",
          )}
          ratio="3/4"
        >
          {image && (
            <SafeImage
              src={image.url}
              alt={image.alt ?? name}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
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
        <p className="text-accent-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          {category.name}
        </p>
        <h3 className="mt-1 text-[15px] leading-snug font-semibold">
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
        className="border-input hover:border-primary hover:bg-primary hover:text-primary-foreground mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg border text-xs font-medium tracking-wide shadow-xs transition-colors duration-200 ease-gentle md:h-9"
      >
        View product
      </Link>
    </article>
  );
}
