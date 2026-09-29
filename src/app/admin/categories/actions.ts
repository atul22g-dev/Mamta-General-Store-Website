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
 * Failures are surfaced — a silent no-op here reads as "the toggle is
 * broken" in the panel.
 */
export async function toggleCategoryActiveAction(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  if (!(await getAdminSession())) throw new Error("Unauthorized");

  const id = formData.get("id")?.toString();
  const next = formData.get("next") === "true";
  if (!id) return { error: "Missing category." };

  try {
    await toggleCategoryActive(id, next);
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : "Could not update the category.",
    };
  }
  revalidateCategorySurfaces();
  return { success: next ? "Category is now visible on the storefront." : "Category hidden from the storefront." };
}

/**
 * Delete a category (admin-gated; blocked while products reference it).
 * The refusal message is surfaced so the user knows to move products first.
 */
export async function deleteCategoryAction(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  if (!(await getAdminSession())) throw new Error("Unauthorized");

  const id = formData.get("id")?.toString();
  if (!id) return { error: "Missing category." };

  const result = await deleteCategory(id);
  if (result.error) return { error: result.error };
  revalidateCategorySurfaces();
  return { success: "Category deleted." };
}
