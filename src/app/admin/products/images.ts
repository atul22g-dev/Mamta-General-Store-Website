"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getAdminSession } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  deleteProductImage,
  productImagePathFromUrl,
  uploadProductImage,
} from "@/lib/supabase/storage";

/**
 * Multi-image management for products: add any number of gallery images and
 * delete individual ones. The primary image (position 0) stays owned by the
 * product form; gallery images start at position 1.
 */

export interface ProductImagesActionState {
  error?: string;
  added?: number;
}

/** Every mutation requires a verified Auth session AND an active ADMIN profile. */
async function assertAdmin(): Promise<void> {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
}

/** Revalidate every surface that renders product images. */
function revalidateProductSurfaces(slug: string | null): void {
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/shop");
  if (slug) revalidatePath(`/products/${slug}`);
}

/**
 * Upload and attach one or more gallery images to a product. Files are
 * validated (type/size) and stored under the product's storage prefix; rows
 * are appended after the current highest position.
 */
export async function addProductImagesAction(
  _prev: ProductImagesActionState,
  formData: FormData,
): Promise<ProductImagesActionState> {
  await assertAdmin();

  const productId = formData.get("productId")?.toString();
  if (!productId) return { error: "Missing product." };

  const files = formData
    .getAll("imageFiles")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one image." };
  if (files.length > 8) return { error: "Up to 8 images can be added at once." };

  const client = getSupabaseAdminClient();

  // Product must exist; slug is needed to revalidate its page.
  const { data: product } = await client
    .from("products")
    .select("id, slug")
    .eq("id", productId)
    .maybeSingle<{ id: string; slug: string }>();
  if (!product) return { error: "Product not found." };

  // Current highest position → gallery images append after it.
  const { data: existing } = await client
    .from("product_images")
    .select("position")
    .eq("productId", productId)
    .order("position", { ascending: false })
    .limit(1);
  const highest = (existing as { position: number }[] | null)?.[0]?.position ?? -1;
  let nextPosition = highest + 1;

  let added = 0;
  try {
    for (const file of files) {
      const uploaded = await uploadProductImage(productId, file);
      const { error } = await client.from("product_images").insert({
        id: randomUUID(),
        productId,
        url: uploaded.url,
        alt: `${product.slug} — dress material photo ${nextPosition + 1}`,
        position: nextPosition,
      } as never);
      if (error) {
        // Row insert failed: remove the just-uploaded object, then stop.
        await deleteProductImage(uploaded.path);
        throw new Error(error.message);
      }
      nextPosition += 1;
      added += 1;
    }
  } catch (error) {
    console.error("[admin-product-images] add failed:", error);
    return {
      error:
        added > 0
          ? `Added ${added} image(s) before an upload failed. Please retry the rest.`
          : "Image upload failed. Please try again.",
      ...(added > 0 ? { added } : {}),
    };
  }

  revalidateProductSurfaces(product.slug);
  return { added };
}

/** Remove one gallery image: the DB row first, then the storage object. */
export async function deleteProductImageAction(formData: FormData): Promise<void> {
  await assertAdmin();

  const imageId = formData.get("imageId")?.toString();
  const productId = formData.get("productId")?.toString();
  if (!imageId || !productId) return;

  const client = getSupabaseAdminClient();

  // Product slug (for revalidation) and the image row are independent reads.
  const [product, image] = await Promise.all([
    client.from("products").select("slug").eq("id", productId).maybeSingle<{ slug: string }>(),
    client
      .from("product_images")
      .select("url")
      .eq("id", imageId)
      .eq("productId", productId)
      .maybeSingle<{ url: string }>(),
  ]);

  const { error } = await client.from("product_images").delete().eq("id", imageId);
  if (error) {
    console.error("[admin-product-images] delete failed:", error);
    return;
  }

  // Storage cleanup is best-effort and only for bucket-hosted objects.
  if (image.data) {
    const path = productImagePathFromUrl(image.data.url);
    if (path) await deleteProductImage(path);
  }

  revalidateProductSurfaces(product.data?.slug ?? null);
}
