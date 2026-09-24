import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Category, CategoryRef } from "@/types/category";
import type { Product, ProductImage, ProductSize, ProductColor } from "@/types/product";

/**
 * Storefront catalog data layer — Supabase (PostgreSQL via supabase-js).
 *
 * Replaces the mock data in `lib/placeholder-data.ts`. Rows map onto the
 * existing domain types (`src/types/*`), so every UI component keeps working
 * unchanged. Table/column names follow `prisma/schema.prisma` (`@@map` names,
 * quoted camelCase columns), and embedded relations use PostgREST's
 * `table ( cols )` syntax.
 *
 * The service-role client is used because Row Level Security currently has no
 * data-API policies — same privilege model as the previous direct database
 * connection. Server-side only ("server-only" guard).
 */

/** PostgREST select string loading a product with all relations. */
const PRODUCT_SELECT = `
  id, name, slug, description, price, "discountPrice", currency, stock, sku,
  brand, featured, "isNewArrival", active, "createdAt", "updatedAt", "categoryId",
  categories ( id, name, slug ),
  product_images ( id, url, alt, position ),
  product_sizes ( id, label ),
  product_colors ( id, name, hex )
`;

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  currency: string;
  stock: number | null;
  sku: string | null;
  brand: string | null;
  featured: boolean;
  isNewArrival: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  categoryId: string;
  categories: { id: string; name: string; slug: string } | null;
  product_images: { id: string; url: string; alt: string | null; position: number }[] | null;
  product_sizes: { id: string; label: string }[] | null;
  product_colors: { id: string; name: string; hex: string | null }[] | null;
}

/** Map a database row (with embedded relations) onto the Product domain type. */
function mapProduct(row: ProductRow): Product {
  const category: CategoryRef = row.categories ?? {
    id: row.categoryId,
    name: "Uncategorized",
    slug: "uncategorized",
  };

  const images: ProductImage[] = (row.product_images ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((image) => ({ id: image.id, url: image.url, alt: image.alt, position: image.position }));

  const sizes: ProductSize[] = (row.product_sizes ?? []).map((size) => ({
    id: size.id,
    label: size.label,
  }));
  const colors: ProductColor[] = (row.product_colors ?? []).map((color) => ({
    id: color.id,
    name: color.name,
    hex: color.hex,
  }));

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category,
    description: row.description,
    price: row.price,
    discountPrice: row.discountPrice,
    images,
    sizes,
    colors,
    stock: row.stock,
    sku: row.sku,
    brand: row.brand,
    featured: row.featured,
    isNewArrival: row.isNewArrival,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CountProductRow {
  categoryId: string;
}

/** Query products with relations, ordered for stable gallery output. */
function productsQuery() {
  return getSupabaseAdminClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .order("position", { referencedTable: "product_images", ascending: true });
}

/** Active products flagged as featured (homepage "Featured Products"). */
export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  const { data, error } = await productsQuery()
    .eq("active", true)
    .eq("featured", true)
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load featured products: ${error.message}`);
  return (data as ProductRow[]).map(mapProduct);
}

/**
 * Products flagged as New Arrivals (homepage section). Falls back to the
 * newest active products while no product is flagged, so the section never
 * renders empty for a stocked store.
 */
export async function getNewArrivals(limit = 4): Promise<Product[]> {
  const flagged = await productsQuery()
    .eq("active", true)
    .eq("isNewArrival", true)
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (!flagged.error && (flagged.data as ProductRow[]).length > 0) {
    return (flagged.data as ProductRow[]).map(mapProduct);
  }

  const { data, error } = await productsQuery()
    .eq("active", true)
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load new arrivals: ${error.message}`);
  return (data as ProductRow[]).map(mapProduct);
}

export interface ShopQuery {
  /** Case-insensitive match on name/description/brand/category name. */
  query?: string;
  /** Category slugs; empty = all. */
  categories?: string[];
  /** Inclusive price band in minor units. */
  priceMin?: number;
  priceMax?: number;
  /** Only products with stock (untracked stock counts as available). */
  inStockOnly?: boolean;
  sort?: "newest" | "price-asc" | "price-desc";
  limit?: number;
}

/**
 * Shop listing: search + category/price/stock filters + sorting, executed in
 * SQL (the previous in-memory filtering over mock data, now database-side).
 */
export async function getShopProducts(options: ShopQuery = {}): Promise<Product[]> {
  const {
    query,
    categories = [],
    priceMin,
    priceMax,
    inStockOnly = false,
    sort = "newest",
    limit = 200,
  } = options;

  let builder = productsQuery().eq("active", true);

  // Search: product fields, plus products in categories whose name matches.
  const term = query?.trim();
  if (term) {
    const escaped = term.replace(/[%,()]/g, "");
    if (escaped) {
      const pattern = `%${escaped}%`;
      const matchingCategories = await getSupabaseAdminClient()
        .from("categories")
        .select("id")
        .ilike("name", pattern);
      const categoryIds = ((matchingCategories.data ?? []) as { id: string }[]).map(
        (row) => row.id,
      );

      const conditions = [
        `name.ilike.${pattern}`,
        `description.ilike.${pattern}`,
        `brand.ilike.${pattern}`,
        ...(categoryIds.length > 0 ? [`categoryId.in.(${categoryIds.join(",")})`] : []),
      ];
      builder = builder.or(conditions.join(","));
    }
  }

  if (categories.length > 0) {
    builder = builder.in("categories.slug", categories);
  }
  if (priceMin !== undefined) {
    builder = builder.gte("price", priceMin);
  }
  if (priceMax !== undefined) {
    builder = builder.lte("price", priceMax);
  }
  // Untracked stock (null) counts as available, mirroring the old behaviour.
  if (inStockOnly) {
    builder = builder.or("stock.is.null,stock.gt.0");
  }

  switch (sort) {
    case "price-asc":
      builder = builder.order("price", { ascending: true });
      break;
    case "price-desc":
      builder = builder.order("price", { ascending: false });
      break;
    case "newest":
    default:
      builder = builder.order("createdAt", { ascending: false });
      break;
  }

  const { data, error } = await builder.limit(limit);
  if (error) throw new Error(`Failed to load products: ${error.message}`);
  return (data as ProductRow[]).map(mapProduct);
}

/** One active product by slug, or null. */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await productsQuery().eq("slug", slug).eq("active", true).maybeSingle();

  if (error) throw new Error(`Failed to load product "${slug}": ${error.message}`);
  return data ? mapProduct(data as ProductRow) : null;
}

/** Related active products from the same category, newest first. */
export async function getRelatedProducts(
  product: Pick<Product, "id" | "category">,
  limit = 4,
): Promise<Product[]> {
  const { data, error } = await productsQuery()
    .eq("active", true)
    .eq("categories.slug", product.category.slug)
    .neq("id", product.id)
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load related products: ${error.message}`);
  return (data as ProductRow[]).map(mapProduct);
}

/** All categories ordered by name — categories are data, so this stays dynamic. */
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("categories")
    .select("id, name, slug, description, imageUrl, createdAt, updatedAt")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return ((data ?? []) as CategoryRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

/** Lightweight { id, name } list for admin form dropdowns. */
export async function getCategoryOptions(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return data ?? [];
}

/** Categories with a count of active products each (for storefront tiles). */
export async function getCategoriesWithCounts(): Promise<
  (CategoryRef & { productCount: number })[]
> {
  const [categoriesResult, productsResult] = await Promise.all([
    getSupabaseAdminClient()
      .from("categories")
      .select("id, name, slug")
      .order("name", { ascending: true }),
    getSupabaseAdminClient().from("products").select("categoryId").eq("active", true),
  ]);

  if (categoriesResult.error) {
    throw new Error(`Failed to load categories: ${categoriesResult.error.message}`);
  }

  const counts = new Map<string, number>();
  for (const row of (productsResult.data ?? []) as CountProductRow[]) {
    counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
  }

  return ((categoriesResult.data ?? []) as { id: string; name: string; slug: string }[]).map(
    (row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      productCount: counts.get(row.id) ?? 0,
    }),
  );
}
