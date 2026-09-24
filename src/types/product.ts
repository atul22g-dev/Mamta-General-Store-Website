import type { CategoryRef } from "@/types/category";

/**
 * Product domain types — mirror `prisma/schema.prisma` → `Product`.
 *
 * Money is stored in minor units (paise) to avoid float rounding:
 * 199900 = ₹1,999.00. Dates are ISO strings so the shape is stable across
 * server components, API responses and client props.
 */

/** Product photo. `position` controls ordering within the gallery. */
export interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}

/** Available size option, e.g. S / M / L / XL / Free Size. */
export interface ProductSize {
  id: string;
  label: string;
}

/** Available color option with an optional swatch hex. */
export interface ProductColor {
  id: string;
  name: string;
  /** Optional hex swatch shown on product pages. */
  hex: string | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: CategoryRef;
  description: string | null;
  /** Current selling price in minor units (paise): 199900 = ₹1,999.00. */
  price: number;
  /** Optional original price shown struck-through, also in minor units. */
  discountPrice: number | null;
  images: ProductImage[];
  sizes: ProductSize[];
  colors: ProductColor[];
  /** Units available; null = not tracked (e.g. made-to-order). */
  stock: number | null;
  /** Stock Keeping Unit — merchant-facing product code. */
  sku: string | null;
  brand: string | null;
  /** Show in "Featured Products" sections. */
  featured: boolean;
  /** Show in the "New Arrivals" homepage section (admin-managed flag). */
  isNewArrival: boolean;
  /** Only `active` products are visible on the storefront. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProductSort = "newest" | "price-asc" | "price-desc";
