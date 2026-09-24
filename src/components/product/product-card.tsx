"use client";

import * as React from "react";
import Link from "next/link";
import { Eye } from "lucide-react";

import type { Product } from "@/types/product";
import { discountPercent, isAvailable } from "@/lib/catalog";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import { cn, formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageArea } from "@/components/ui/image-area";

/**
 * Product card: image area with discount + availability badges, category
 * eyebrow, serif name, price (+ struck-through original) and a quick-add
 * button (disabled when out of stock). Links to the product detail page,
 * where size/color are chosen.
 */
export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const { name, price, discountPrice, category, images } = product;
  const image = images[0];
  const available = isAvailable(product);
  const discount = discountPercent(product);

  return (
    <article className={cn("group flex flex-col gap-3", className)}>
      <Link
        href={`/products/${product.slug}`}
        aria-label={`View ${name}`}
        className="relative block"
      >
        <ImageArea
          className={cn(
            "transition-shadow duration-300 ease-gentle group-hover:shadow-soft-lg",
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
                "absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-gentle group-hover:scale-[1.03]",
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

      <div className="space-y-1">
        <p className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
          {category.name}
        </p>
        <h3 className="font-display text-base leading-snug font-medium">
          <Link href={`/products/${product.slug}`} className="transition-colors hover:opacity-80">
            {name}
          </Link>
        </h3>
        <p className="flex items-baseline gap-2 pt-0.5">
          <span className="text-sm font-semibold">{formatPrice(price, DEFAULT_CURRENCY)}</span>
          {discountPrice && discountPrice > price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(discountPrice, DEFAULT_CURRENCY)}
            </span>
          )}
        </p>
        {product.description && (
          <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
            {product.description}
          </p>
        )}
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs",
            available ? "text-muted-foreground" : "text-destructive",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              available ? "bg-emerald-600/70" : "bg-destructive",
            )}
          />
          {available ? "In stock" : "Out of stock"}
          {images.length > 1 && (
            <span className="text-muted-foreground/70">· {images.length} photos</span>
          )}
        </p>
      </div>

      <Button variant="outline" size="sm" className="mt-auto w-full" asChild>
        <Link href={`/products/${product.slug}`} aria-label={`View ${name}`}>
          <Eye aria-hidden="true" />
          View Product
        </Link>
      </Button>
    </article>
  );
}
