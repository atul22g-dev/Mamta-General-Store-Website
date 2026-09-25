import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Admin category management. Categories are plain rows — the storefront
 * (navigation, category pages, sitemap) reads them live, so changes apply
 * without any code changes. Inactive categories stay listed here with a
 * Show/Hide toggle; the storefront hides them (migration 0008's active flag).
 */

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  /** Inactive categories are hidden from the storefront. */
  active: boolean;
  productCount: number;
}

/** All categories with active-product counts, ordered by name. */
export async function listAdminCategories(): Promise<AdminCategory[]> {
  const client = await getSupabaseAdminClient();
  const [categoriesResult, productsResult] = await Promise.all([
    client
      .from("categories")
      .select("id, name, slug, description, imageUrl, active")
      .order("name", { ascending: true }),
    client.from("products").select("categoryId").eq("active", true),
  ]);

  if (categoriesResult.error) {
    throw new Error(`Failed to load categories: ${categoriesResult.error.message}`);
  }

  interface CountRow {
    categoryId: string;
  }
  const counts = new Map<string, number>();
  for (const row of (productsResult.data ?? []) as CountRow[]) {
    counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
  }

  return ((categoriesResult.data ?? []) as AdminCategory[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.imageUrl,
    active: row.active,
    productCount: counts.get(row.id) ?? 0,
  }));
}

/** Create a category. Returns an error message instead of throwing for UX. */
export async function createCategory(input: {
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  /** Defaults to active (visible on the storefront). */
  active?: boolean;
}): Promise<{ error?: string }> {
  const { error } = await (await getSupabaseAdminClient()).from("categories").insert({
    id: input.slug,
    name: input.name,
    slug: input.slug,
    description: input.description,
    imageUrl: input.imageUrl,
    active: input.active ?? true,
  } as never);
  if (error) {
    if (error.code === "23505") return { error: "A category with this slug already exists." };
    return { error: error.message };
  }
  return {};
}

/** Update a category's display fields (id/slug are immutable here). */
export async function updateCategory(input: {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
}): Promise<{ error?: string }> {
  const { error } = await (
    await getSupabaseAdminClient()
  )
    .from("categories")
    .update({
      name: input.name,
      description: input.description,
      imageUrl: input.imageUrl,
    } as never)
    .eq("id", input.id);
  if (error) return { error: error.message };
  return {};
}

/**
 * Toggle a category's storefront visibility. Inactive categories vanish from
 * every storefront surface and their products stop showing; the admin panel
 * keeps listing them so they can be switched back on.
 */
export async function toggleCategoryActive(id: string, next: boolean): Promise<void> {
  const { error } = await (
    await getSupabaseAdminClient()
  )
    .from("categories")
    .update({ active: next } as never)
    .eq("id", id);
  if (error) throw new Error(`Failed to update category: ${error.message}`);
}

/**
 * Delete a category. The schema restricts deletion while products reference
 * it, so the caller sees a clear message instead of data loss.
 */
export async function deleteCategory(id: string): Promise<{ error?: string }> {
  const { error } = await (await getSupabaseAdminClient()).from("categories").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { error: "This category still has products. Move them first." };
    }
    return { error: error.message };
  }
  return {};
}
