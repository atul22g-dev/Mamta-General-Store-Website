"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/auth/session";
import { slugOrSkuTaken } from "@/lib/admin-products";
import { productFormSchema, slugifyName, toDatabaseValues } from "@/lib/validation/product";
import {
  productImagePathFromUrl,
  uploadProductImage,
  deleteProductImage,
  deleteAllProductImages,
} from "@/lib/supabase/storage";

export interface ProductFormState {
  errors?: Record<string, string[]>;
  formError?: string;
}

/** Every mutation requires a verified Auth session AND an active ADMIN profile. */
async function assertAdmin(): Promise<void> {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
}

/** PostgREST unique-violation code (slug collisions). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

/**
 * Create or update a product, including its main image: an uploaded file is
 * stored in Supabase Storage (server-side only), otherwise the provided URL
 * is used. The previous uploaded object is removed after a successful
 * replace. Returns field errors on failure; redirects on success.
 */
export async function saveProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await assertAdmin();

  const raw = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    categoryId: formData.get("categoryId"),
    description: formData.get("description") ?? "",
    price: formData.get("price"),
    discountPrice: formData.get("discountPrice"),
    imageUrl: formData.get("imageUrl"),
    stock: formData.get("stock"),
    active: formData.get("active") === "on",
    featured: formData.get("featured") === "on",
    isNewArrival: formData.get("isNewArrival") === "on",
  };

  const parsed = productFormSchema.safeParse(raw);
  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    return { errors: flattened.fieldErrors as Record<string, string[]> };
  }

  const data = parsed.data;
  const id = formData.get("id")?.toString() || undefined;

  // Image resolution: an uploaded file wins; otherwise the URL field is used.
  const imageFile = formData.get("imageFile");
  const hasFile = imageFile instanceof File && imageFile.size > 0;

  if (!hasFile && !data.imageUrl) {
    return {
      errors: { imageUrl: ["Upload an image file or provide an image URL"] },
    };
  }

  // Auto-slug from the name when left blank.
  const slug = data.slug || slugifyName(data.name);

  const { slugTaken } = await slugOrSkuTaken(slug, null, id);
  if (slugTaken) {
    return {
      errors: {
        slug: ["This slug is already in use"],
      },
    };
  }

  const productValues = toDatabaseValues(data);
  const client = getSupabaseAdminClient();

  // The product id: existing on edit, generated up-front on create so the
  // upload lands directly under the final storage prefix (no move needed).
  const productId = id ?? randomUUID();

  // Previous image, for cleanup when replaced on edit.
  let previousImageUrl: string | null = null;
  if (id) {
    const { data: existingImage } = await client
      .from("product_images")
      .select("url")
      .eq("productId", id)
      .eq("position", 0)
      .maybeSingle<{ url: string }>();
    previousImageUrl = existingImage?.url ?? null;
  }

  try {
    // Category must exist — validates the FK before insert.
    const { data: categoryExists } = await client
      .from("categories")
      .select("id")
      .eq("id", data.categoryId)
      .maybeSingle();
    if (!categoryExists) {
      return { errors: { categoryId: ["Choose a valid category"] } };
    }

    // 1. Upload the file (if any) — before any database writes so a failed
    //    upload leaves the product data untouched.
    let uploadedUrl: string | null = null;
    let uploadedPath: string | null = null;
    if (hasFile) {
      try {
        const uploaded = await uploadProductImage(productId, imageFile as File);
        uploadedUrl = uploaded.url;
        uploadedPath = uploaded.path;
      } catch (uploadError) {
        console.error("[admin-products] image upload failed:", uploadError);
        return {
          formError:
            uploadError instanceof Error
              ? uploadError.message
              : "Image upload failed. Please try again.",
        };
      }
    }

    const imageUrl = uploadedUrl ?? data.imageUrl ?? null;

    if (id) {
      // 2a. Update the product row.
      const { error: updateError } = await client
        .from("products")
        .update(productValues as never)
        .eq("id", id);
      if (updateError) throw updateError;

      // 3a. Replace the primary image row (position 0).
      const { error: imageDeleteError } = await client
        .from("product_images")
        .delete()
        .eq("productId", id)
        .eq("position", 0);
      if (imageDeleteError) throw imageDeleteError;
      const { error: imageInsertError } = await client.from("product_images").insert({
        id: randomUUID(),
        productId: id,
        url: imageUrl,
        alt: data.name,
        position: 0,
      } as never);
      if (imageInsertError) throw imageInsertError;
    } else {
      // 2b. Create the product with the pre-generated id.
      const { error: insertError } = await client
        .from("products")
        .insert({ id: productId, ...productValues } as never);
      if (insertError) throw insertError;

      // 3b. Insert the primary image row.
      const { error: imageInsertError } = await client.from("product_images").insert({
        id: randomUUID(),
        productId,
        url: imageUrl,
        alt: data.name,
        position: 0,
      } as never);
      if (imageInsertError) throw imageInsertError;
    }

    // 4. Cleanup: remove the replaced storage object only after the database
    //    is consistent (only when a new file replaced an uploaded image).
    if (id && uploadedPath && previousImageUrl) {
      const previousPath = productImagePathFromUrl(previousImageUrl);
      if (previousPath) {
        await deleteProductImage(previousPath);
      }
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { formError: "A product with this slug already exists." };
    }
    console.error("[admin-products]", error);
    return { formError: "Could not save the product. Please try again." };
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/shop");
  redirect("/admin/products?saved=1");
}

/** Delete a product after confirmation (client-side dialog gates the call). */
export async function deleteProductAction(formData: FormData): Promise<void> {
  await assertAdmin();

  const id = formData.get("id")?.toString();
  if (!id) return;

  // Storage cleanup first (id-derived, no DB read needed): cascades handle
  // product_images rows; order history is preserved as before.
  await deleteAllProductImages(id);

  try {
    const { error } = await getSupabaseAdminClient().from("products").delete().eq("id", id);
    if (error) throw error;
  } catch {
    // Deletion failures are non-fatal for the list render, as before.
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/shop");
}

/** Toggle a product's storefront visibility. */
export async function toggleProductActiveAction(formData: FormData): Promise<void> {
  await assertAdmin();

  const id = formData.get("id")?.toString();
  const next = formData.get("next") === "true";
  if (!id) return;

  try {
    const { error } = await getSupabaseAdminClient()
      .from("products")
      .update({ active: next } as never)
      .eq("id", id);
    if (error) throw error;
  } catch {
    // Non-fatal, as before.
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/shop");
}

/** Toggle homepage featuring. */
export async function toggleProductFeaturedAction(formData: FormData): Promise<void> {
  await assertAdmin();

  const id = formData.get("id")?.toString();
  const next = formData.get("next") === "true";
  if (!id) return;

  try {
    const { error } = await getSupabaseAdminClient()
      .from("products")
      .update({ featured: next } as never)
      .eq("id", id);
    if (error) throw error;
  } catch {
    // Non-fatal, as before.
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
}
