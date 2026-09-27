import type { Product, ProductSort } from "@/types/product";

/**
 * Catalog query helpers — pure functions over Product[] used by the shop's
 * interactive filtering (ShopView). Money is in minor units (paise).
 *
 * Product *lookups* (by slug, related items) happen in SQL instead
 * (`lib/supabase/catalog.ts`) so pages never ship the whole catalog.
 */

export interface CatalogFilters {
  /** Case-insensitive substring match on name/description/brand/category. */
  query: string;
  /** Category slugs; empty = all. */
  categories: string[];
  /** Inclusive price band in minor units; undefined bounds = open-ended. */
  priceMin?: number;
  priceMax?: number;
  /** Only in-stock products. */
  inStockOnly: boolean;
}

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
] as const satisfies ReadonlyArray<{ value: ProductSort; label: string }>;

export function parseSort(value: string | null | undefined): ProductSort {
  return SORT_OPTIONS.some((o) => o.value === value) ? (value as ProductSort) : "newest";
}

/** Named price bands for the quick-filter chips (minor units). */
export const PRICE_BANDS = [
  { id: "under-1000", label: "Under ₹1,000", min: 0, max: 100_000 },
  { id: "1000-2500", label: "₹1,000 – ₹2,500", min: 100_000, max: 250_000 },
  { id: "2500-5000", label: "₹2,500 – ₹5,000", min: 250_000, max: 500_000 },
  { id: "over-5000", label: "Over ₹5,000", min: 500_000, max: undefined },
] as const;

export type PriceBandId = (typeof PRICE_BANDS)[number]["id"];

function matchesQuery(product: Product, query: string): boolean {
  if (!query) return true;
  const haystack = [product.name, product.description, product.brand, product.category.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

function matchesPrice(product: Product, min?: number, max?: number): boolean {
  if (min !== undefined && product.price < min) return false;
  if (max !== undefined && product.price > max) return false;
  return true;
}

export function sortProducts(products: Product[], sort: ProductSort): Product[] {
  const sorted = [...products];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "newest":
    default:
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }
}

export function filterProducts(products: Product[], filters: CatalogFilters): Product[] {
  const selectedCategories = new Set(filters.categories); // constant-time membership per product
  return products.filter(
    (product) =>
      product.active &&
      (!filters.inStockOnly || product.stock === null || product.stock > 0) &&
      (selectedCategories.size === 0 || selectedCategories.has(product.category.slug)) &&
      matchesPrice(product, filters.priceMin, filters.priceMax) &&
      matchesQuery(product, filters.query),
  );
}

export function filterAndSort(
  products: Product[],
  filters: CatalogFilters,
  sort: ProductSort,
): Product[] {
  return sortProducts(filterProducts(products, filters), sort);
}

/** Category counts within the currently query/price/stock-filtered set. */
export function countByCategory(products: Product[], base: CatalogFilters): Record<string, number> {
  const withoutCategories: CatalogFilters = { ...base, categories: [] };
  const counts: Record<string, number> = {};
  for (const product of filterProducts(products, withoutCategories)) {
    counts[product.category.slug] = (counts[product.category.slug] ?? 0) + 1;
  }
  return counts;
}

/* ------------------------------------------------------------------ */
/* Single-product helpers (shared by cards and the product page)       */
/* ------------------------------------------------------------------ */

/** Availability derived from stock (null = not tracked = available). */
export function isAvailable(product: Product): boolean {
  return product.stock === null || product.stock > 0;
}

/**
 * Order two products for a "You may also like" section.
 *
 * Similarity, in priority order (a strict weak ordering — no ties survive):
 *   1. Same category beats different category — a suit shopper sees suits.
 *   2. Shared brand next — same maker suggests a matching collection.
 *   3. In stock beats sold out — purchasable items are more useful.
 *   4. Closer price band wins (log ratio, so ₹100 vs ₹150 outranks
 *      ₹100 vs ₹10,000 regardless of absolute level).
 *   5. Newest first as the final tiebreaker.
 */
export function rankSimilarProducts(
  reference: Product,
  candidates: Product[],
): Product[] {
  const sameCategory = (p: Product) => Number(p.category.id === reference.category.id);
  const sharedBrand = (p: Product) =>
    Number(
      Boolean(reference.brand) && Boolean(p.brand) && reference.brand === p.brand,
    );
  const inStock = (p: Product) => Number(isAvailable(p));

  // Log price distance in paise (min ₹1 to stay finite); 0 → perfect match.
  const priceDistance = (p: Product) => {
    const a = Math.max(reference.price, 100);
    const b = Math.max(p.price, 100);
    return Math.abs(Math.log(a) - Math.log(b));
  };

  return candidates
    .map((product) => ({
      product,
      keys: [
        -sameCategory(product), // ascending sort → same category first
        -sharedBrand(product),
        -inStock(product),
        priceDistance(product),
        -new Date(product.createdAt).getTime(),
      ] as const,
    }))
    .sort((a, b) => {
      for (let i = 0; i < a.keys.length; i += 1) {
        if (a.keys[i] !== b.keys[i]) return a.keys[i]! - b.keys[i]!;
      }
      return 0;
    })
    .map((entry) => entry.product);
}

/**
 * Build the "You may also like" list: the most similar products first, and
 * — when the reference's own category runs out — the grid still fills with
 * the best-scoring picks from other categories rather than leaving gaps.
 */
export function buildRelatedList(
  reference: Product,
  candidates: Product[],
  limit = 4,
): Product[] {
  return rankSimilarProducts(reference, candidates.filter((p) => p.id !== reference.id)).slice(
    0,
    limit,
  );
}

/**
 * Discount percentage off the original price, e.g. 17 for "17% off".
 *
 * Terminology: `price` is the CURRENT selling price; the database column
 * `discountPrice` (displayed struck-through) holds the ORIGINAL/reference
 * price from before the discount. A discount exists only when that original
 * is strictly higher than the current price.
 */
export function discountPercent(product: Product): number | null {
  const { price, discountPrice } = product;
  if (!discountPrice || discountPrice <= price) return null;
  return Math.round(((discountPrice - price) / discountPrice) * 100);
}
