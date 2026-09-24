import type { Product, ProductSort } from "@/types/product";

/**
 * Catalog query helpers — pure functions over Product[].
 *
 * Today they run on mock data; when the database is connected these same
 * signatures translate to Prisma `where`/`orderBy` clauses, so callers don't
 * change. Money is in minor units (paise).
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

export const DEFAULT_FILTERS: CatalogFilters = {
  query: "",
  categories: [],
  inStockOnly: false,
};

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
 * Discount percentage off the original price, e.g. 17 for "17% off".
 * `discountPrice` holds the original (pre-discount) price.
 */
export function discountPercent(product: Product): number | null {
  const { price, discountPrice } = product;
  if (!discountPrice || discountPrice <= price) return null;
  return Math.round(((discountPrice - price) / discountPrice) * 100);
}

/** Find an active product by slug (storefront lookup). */
export function findProductBySlug(products: Product[], slug: string): Product | undefined {
  return products.find((product) => product.slug === slug && product.active);
}

/**
 * Related products from the same category (excluding the product itself),
 * newest first.
 */
export function relatedProducts(products: Product[], product: Product, limit = 4): Product[] {
  return sortProducts(
    products.filter(
      (p) => p.active && p.category.slug === product.category.slug && p.id !== product.id,
    ),
    "newest",
  ).slice(0, limit);
}
