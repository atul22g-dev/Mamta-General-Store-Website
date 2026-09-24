import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Admin product queries — supabase-js implementation. The list supports
 * search (name/sku/slug), category + status filters, and pagination,
 * executed in SQL with a one-image join for thumbnails.
 */

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  price: number;
  discountPrice: number | null;
  stock: number | null;
  sku: string | null;
  active: boolean;
  featured: boolean;
  isNewArrival: boolean;
  createdAt: Date;
  categoryName: string;
  categoryId: string;
  imageUrl: string | null;
}

export interface ProductListResult {
  rows: AdminProductRow[];
  total: number;
}

export interface ProductListParams {
  query?: string;
  categoryId?: string;
  /** all | active | inactive */
  status?: "all" | "active" | "inactive";
  page?: number;
  pageSize?: number;
}

const LIST_SELECT = `
  id, name, slug, price, "discountPrice", stock, sku, active, featured, "isNewArrival", "createdAt",
  "categoryId", categories ( id, name ),
  product_images ( url, position )
`;

interface ListRow {
  id: string;
  name: string;
  slug: string;
  price: number;
  discountPrice: number | null;
  stock: number | null;
  sku: string | null;
  active: boolean;
  featured: boolean;
  isNewArrival: boolean;
  createdAt: string;
  categoryId: string;
  categories: { id: string; name: string } | null;
  product_images: { url: string; position: number }[] | null;
}

/** True when another product already uses the slug or SKU. */
export async function slugOrSkuTaken(
  slug: string,
  sku: string | null,
  excludeId?: string,
): Promise<{ slugTaken: boolean; skuTaken: boolean }> {
  const client = getSupabaseAdminClient();

  const slugQuery = client.from("products").select("id").eq("slug", slug).limit(1);
  const skuQuery = sku ? client.from("products").select("id").eq("sku", sku).limit(1) : null;

  // PostgREST builders are mutable; filter before awaiting.
  if (excludeId) {
    slugQuery.neq("id", excludeId);
    skuQuery?.neq("id", excludeId);
  }

  const [slugResult, skuResult] = await Promise.all([
    slugQuery.maybeSingle(),
    skuQuery ? skuQuery.maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);

  if (slugResult.error) throw new Error(`Slug check failed: ${slugResult.error.message}`);
  if (skuResult.error) throw new Error(`SKU check failed: ${skuResult.error.message}`);

  return { slugTaken: Boolean(slugResult.data), skuTaken: Boolean(skuResult.data) };
}

export async function listAdminProducts(
  params: ProductListParams = {},
): Promise<ProductListResult> {
  const { query, categoryId, status = "all", page = 1, pageSize = 10 } = params;

  const client = getSupabaseAdminClient();

  // Count query mirrors the filters exactly.
  let countBuilder = client.from("products").select("id", { count: "exact", head: true });
  if (query) {
    const pattern = `%${query.trim().replace(/[%,()]/g, "")}%`;
    countBuilder = countBuilder.or(
      `name.ilike.${pattern},sku.ilike.${pattern},slug.ilike.${pattern}`,
    );
  }
  if (categoryId) countBuilder = countBuilder.eq("categoryId", categoryId);
  if (status === "active") countBuilder = countBuilder.eq("active", true);
  if (status === "inactive") countBuilder = countBuilder.eq("active", false);
  const { count: total, error: countError } = await countBuilder;
  if (countError) throw new Error(`Failed to count products: ${countError.message}`);

  let builder = client
    .from("products")
    .select(LIST_SELECT)
    .order("createdAt", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (query) {
    const pattern = `%${query.trim().replace(/[%,()]/g, "")}%`;
    builder = builder.or(`name.ilike.${pattern},sku.ilike.${pattern},slug.ilike.${pattern}`);
  }
  if (categoryId) builder = builder.eq("categoryId", categoryId);
  if (status === "active") builder = builder.eq("active", true);
  if (status === "inactive") builder = builder.eq("active", false);

  const { data, error } = await builder;
  if (error) throw new Error(`Failed to list products: ${error.message}`);

  const rows = (data as ListRow[]).map((row) => {
    const firstImage = (row.product_images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)[0];
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      price: row.price,
      discountPrice: row.discountPrice,
      stock: row.stock,
      sku: row.sku,
      active: row.active,
      featured: row.featured,
      isNewArrival: row.isNewArrival,
      createdAt: new Date(row.createdAt),
      categoryName: row.categories?.name ?? "Uncategorized",
      categoryId: row.categories?.id ?? row.categoryId,
      imageUrl: firstImage?.url ?? null,
    };
  });

  return { rows, total: total ?? 0 };
}

export interface AdminProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  stock: number | null;
  sku: string | null;
  brand: string | null;
  active: boolean;
  featured: boolean;
  isNewArrival: boolean;
  categoryId: string;
  imageUrl: string | null;
}

/** All images for a product, in display order (admin gallery manager). */
export async function getAdminProductImages(
  productId: string,
): Promise<{ id: string; url: string; alt: string | null; position: number }[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("product_images")
    .select("id, url, alt, position")
    .eq("productId", productId)
    .order("position", { ascending: true });

  if (error) throw new Error(`Failed to load product images: ${error.message}`);
  return data ?? [];
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from("products")
    .select(`${LIST_SELECT}, description, brand`)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load product: ${error.message}`);
  if (!data) return null;

  const row = data as ListRow & { description: string | null; brand: string | null };
  const firstImage = (row.product_images ?? []).slice().sort((a, b) => a.position - b.position)[0];

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price,
    discountPrice: row.discountPrice,
    stock: row.stock,
    sku: row.sku,
    brand: row.brand,
    active: row.active,
    featured: row.featured,
    isNewArrival: row.isNewArrival,
    categoryId: row.categoryId,
    imageUrl: firstImage?.url ?? null,
  };
}
