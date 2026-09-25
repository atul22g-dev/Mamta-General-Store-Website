"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAdminSession } from "@/lib/auth/session";
import { slugifyName } from "@/lib/validation/product";
import {
  createCategory,
  deleteCategory,
  toggleCategoryActive,
  updateCategory,
} from "@/lib/supabase/admin-categories";

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  slug: z.string().trim().max(60).optional(),
  description: z.string().trim().max(300).optional(),
  imageUrl: z.string().trim().url("Enter a valid URL").max(1000).optional().or(z.literal("")),
});

/** Revalidate every storefront surface that renders categories. */
function revalidateCategorySurfaces(): void {
  revalidatePath("/admin/categories");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/categories");
}

export interface CategoryActionState {
  error?: string;
  success?: string;
}

/** Create a category (admin-gated). */
export async function createCategoryAction(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  if (!(await getAdminSession())) throw new Error("Unauthorized");

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
    description: formData.get("description") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
  });
  if (!parsed.success) {
    return { error: z.flattenError(parsed.error).fieldErrors.name?.[0] ?? "Invalid details." };
  }

  const slug = parsed.data.slug || slugifyName(parsed.data.name);
  const result = await createCategory({
    name: parsed.data.name,
    slug,
    description: parsed.data.description ?? null,
    imageUrl: parsed.data.imageUrl || null,
    active: formData.get("active") === "on",
  });
  if (result.error) return { error: result.error };

  revalidateCategorySurfaces();
  return { success: `Category “${parsed.data.name}” created.` };
}

/** Update a category's name/description/image (admin-gated). */
export async function updateCategoryAction(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  if (!(await getAdminSession())) throw new Error("Unauthorized");

  const id = formData.get("id")?.toString();
  if (!id) return { error: "Missing category." };

  const parsed = categorySchema.safeParse({
    id,
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
  });
  if (!parsed.success) {
    return { error: z.flattenError(parsed.error).fieldErrors.name?.[0] ?? "Invalid details." };
  }

  const result = await updateCategory({
    id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    imageUrl: parsed.data.imageUrl || null,
  });
  if (result.error) return { error: result.error };

  revalidateCategorySurfaces();
  return { success: "Category updated." };
}

/**
 * Toggle a category's storefront visibility (admin-gated). Inactive
 * categories disappear from the storefront together with their products.
 */
export async function toggleCategoryActiveAction(formData: FormData): Promise<void> {
  if (!(await getAdminSession())) throw new Error("Unauthorized");

  const id = formData.get("id")?.toString();
  const next = formData.get("next") === "true";
  if (!id) return;

  try {
    await toggleCategoryActive(id, next);
  } catch {
    // Non-fatal for the list render; the row keeps its previous state.
  }
  revalidateCategorySurfaces();
}

/** Delete a category (admin-gated; blocked while products reference it). */
export async function deleteCategoryAction(formData: FormData): Promise<void> {
  if (!(await getAdminSession())) throw new Error("Unauthorized");

  const id = formData.get("id")?.toString();
  if (!id) return;

  await deleteCategory(id);
  revalidateCategorySurfaces();
}
