import "server-only";

import { getSupabasePublicClient } from "@/lib/supabase/public";
import type { Category, CategoryRef } from "@/types/category";
import type { Product, ProductImage, ProductSize, ProductColor } from "@/types/product";

/**
 * Storefront catalog data layer — Supabase (PostgreSQL via supabase-js).
 *
 * Rows map onto the existing domain types (`src/types/*`), so every UI
 * component keeps working unchanged. Table/column names follow
 * `prisma/schema.prisma` (`@@map` names, quoted camelCase columns), and
 * embedded relations use PostgREST's `table ( cols )` syntax.
 *
 * The public anon-key client is used: Row Level Security policies (migration
 * 0007) allow public reads of the catalog and nothing else. Server-side only
 * ("server-only" guard).
 *
 * Graceful schema-lag guard: if the `categories.active` column has not been
 * applied yet (migration 0008), category-visibility queries fall back to the
 * pre-feature behaviour (everything visible) instead of crashing pages.
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

/** Postgres error for "the column is not there yet" (migration 0008 pending). */
const SCHEMA_LAG = /column .* does not exist/i;
let schemaLagLogged = false;

/**
 * Ids of active categories — products in inactive categories are hidden.
 * Returns null when the active column is missing (feature unavailable);
 * callers then skip the visibility filter instead of failing.
 */
async function activeCategoryIds(): Promise<string[] | null> {
  const { data, error } = await getSupabasePublicClient()
    .from("categories")
    .select("id")
    .eq("active", true);
  if (error) {
    if (SCHEMA_LAG.test(error.message)) {
      if (!schemaLagLogged) {
        schemaLagLogged = true;
        console.warn(
          "[catalog] categories.active is missing — run supabase/migrations/0008_category_active.sql. " +
            "Category visibility filtering is disabled until then.",
        );
      }
      return null;
    }
    throw new Error(`Failed to load categories: ${error.message}`);
  }
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

/** Active-product count per category (for the zero-products rule). */
async function activeProductCountByCategory(): Promise<Map<string, number>> {
  const { data, error } = await getSupabasePublicClient()
    .from("products")
    .select("categoryId")
    .eq("active", true);
  if (error) throw new Error(`Failed to load products: ${error.message}`);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as CountProductRow[]) {
    counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
  }
  return counts;
}

/** Query products with relations, ordered for stable gallery output. */
function productsQuery() {
  return getSupabasePublicClient()
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

  // Products in inactive categories are hidden from every storefront listing.
  const visibleIds = await activeCategoryIds();
  if (visibleIds !== null) {
    if (visibleIds.length === 0) return [];
    builder = builder.in("categoryId", visibleIds);
  }

  // Search: product fields, plus products in categories whose name matches.
  const term = query?.trim();
  if (term) {
    const escaped = term.replace(/[%,()]/g, "");
    if (escaped) {
      const pattern = `%${escaped}%`;
      const matchingCategories = await getSupabasePublicClient()
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

/** One active product by slug, or null — hidden when its category is inactive. */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const [{ data, error }, visibleIds] = await Promise.all([
    productsQuery().eq("slug", slug).eq("active", true).maybeSingle(),
    activeCategoryIds(),
  ]);

  if (error) throw new Error(`Failed to load product "${slug}": ${error.message}`);
  if (!data) return null;
  const row = data as ProductRow;
  if (visibleIds !== null && !visibleIds.includes(row.categoryId)) return null;
  return mapProduct(row);
}

/** Related active products from the same category, newest first. */
export async function getRelatedProducts(
  product: Pick<Product, "id" | "category">,
  limit = 4,
): Promise<Product[]> {
  const visibleIds = await activeCategoryIds();
  if (visibleIds !== null && visibleIds.length === 0) return [];

  let builder = productsQuery()
    .eq("active", true)
    .eq("categories.slug", product.category.slug)
    .neq("id", product.id);
  if (visibleIds !== null) builder = builder.in("categoryId", visibleIds);

  const { data, error } = await builder.order("createdAt", { ascending: false }).limit(limit);

  if (error) throw new Error(`Failed to load related products: ${error.message}`);
  return (data as ProductRow[]).map(mapProduct);
}

/**
 * Storefront categories, ordered by name: only ACTIVE categories that have
 * at least one active product (a zero-product category stays hidden until it
 * is stocked). Powers the header nav, home tiles, /categories and sitemap.
 * Falls back to "all categories" while the active column is missing.
 */
export async function getCategories(): Promise<Category[]> {
  const [categoriesResult, counts] = await Promise.all([
    getSupabasePublicClient()
      .from("categories")
      .select("id, name, slug, description, imageUrl, createdAt, updatedAt")
      .order("name", { ascending: true }),
    activeProductCountByCategory().catch(() => new Map<string, number>()),
  ]);

  if (categoriesResult.error) {
    if (!SCHEMA_LAG.test(categoriesResult.error.message)) {
      throw new Error(`Failed to load categories: ${categoriesResult.error.message}`);
    }
    // Column missing: read without the visibility filter (pre-feature view).
    const fallback = await getSupabasePublicClient()
      .from("categories")
      .select("id, name, slug, description, imageUrl, createdAt, updatedAt")
      .order("name", { ascending: true });
    if (fallback.error) {
      throw new Error(`Failed to load categories: ${fallback.error.message}`);
    }
    return ((fallback.data ?? []) as CategoryRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  return ((categoriesResult.data ?? []) as CategoryRow[])
    .filter((row) => (counts.get(row.id) ?? 0) > 0)
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
}

/** One category by slug, or null — inactive categories resolve to null (404). */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const client = getSupabasePublicClient();
  const columns = "id, name, slug, description, imageUrl, createdAt, updatedAt";

  const filtered = await client
    .from("categories")
    .select(columns)
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle<CategoryRow>();

  let data = filtered.data as CategoryRow | null;
  if (filtered.error && SCHEMA_LAG.test(filtered.error.message)) {
    // Column missing: match the pre-feature behaviour (every category visible).
    const fallback = await client
      .from("categories")
      .select(columns)
      .eq("slug", slug)
      .maybeSingle<CategoryRow>();
    if (fallback.error) {
      throw new Error(`Failed to load category: ${fallback.error.message}`);
    }
    data = (fallback.data as CategoryRow | null) ?? null;
  } else if (filtered.error) {
    throw new Error(`Failed to load category: ${filtered.error.message}`);
  }

  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    imageUrl: data.imageUrl,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/** Lightweight { id, name } list for admin form dropdowns. */
export async function getCategoryOptions(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await getSupabasePublicClient()
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
    getSupabasePublicClient()
      .from("categories")
      .select("id, name, slug")
      .order("name", { ascending: true }),
    getSupabasePublicClient().from("products").select("categoryId").eq("active", true),
  ]);

  if (categoriesResult.error) {
    throw new Error(`Failed to load categories: ${categoriesResult.error.message}`);
  }

  const counts = new Map<string, number>();
  for (const row of (productsResult.data ?? []) as CountProductRow[]) {
    counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
  }

  // Same zero-products rule as getCategories: empty categories stay hidden.
  return ((categoriesResult.data ?? []) as { id: string; name: string; slug: string }[])
    .filter((row) => (counts.get(row.id) ?? 0) > 0)
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      productCount: counts.get(row.id) ?? 0,
    }));
}
