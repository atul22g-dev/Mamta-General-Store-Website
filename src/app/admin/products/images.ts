"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getAdminSession } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  deleteProductImage,
  productImageUrl,
  productImagePathFromUrl,
  uploadProductImage,
  PRODUCT_IMAGES_BUCKET,
} from "@/lib/supabase/storage";

/**
 * Multi-image management for products: add any number of gallery images and
 * delete individual ones. The primary image (position 0) stays owned by the
 * product form; gallery images start at position 1.
 */

export interface ProductImagesActionState {
  error?: string;
  added?: number;
  reordered?: boolean;
  newCoverUrl?: string;
  /** Image id whose alt text was just saved (for targeted UI feedback). */
  altSavedFor?: string;
}

/**
 * Update one image's alt text. Accessibility data lives with the image row;
 * auto-generated alts are placeholders the admin should refine.
 */
export async function updateImageAltAction(
  _prev: ProductImagesActionState,
  formData: FormData,
): Promise<ProductImagesActionState> {
  await assertAdmin();

  const productId = formData.get("productId")?.toString();
  const imageId = formData.get("imageId")?.toString();
  const alt = formData.get("alt")?.toString().trim() ?? "";
  if (!productId || !imageId) return { error: "Missing product or photo." };
  if (alt.length > 300) return { error: "Alt text is too long (max 300 characters)." };

  const client = await getSupabaseAdminClient();

  // Verify ownership before writing (anti-tampering, same as reorder).
  const { data: owned } = await client
    .from("product_images")
    .select("id")
    .eq("id", imageId)
    .eq("productId", productId)
    .maybeSingle<{ id: string }>();
  if (!owned) return { error: "Photo not found — please refresh and try again." };

  const { error } = await client
    .from("product_images")
    .update({ alt: alt === "" ? null : alt } as never)
    .eq("id", imageId)
    .eq("productId", productId);
  if (error) {
    console.error("[admin-product-images] alt update failed:", error);
    return { error: `Could not save the alt text: ${error.message}` };
  }

  // Slug for storefront revalidation (screen readers see the new text).
  const { data: product } = await client
    .from("products")
    .select("slug")
    .eq("id", productId)
    .maybeSingle<{ slug: string }>();
  revalidateProductSurfaces(product?.slug ?? null);

  return { altSavedFor: imageId };
}

/**
 * Remove storage objects that are no longer referenced by any product_images
 * row (orphans from interrupted uploads or replaced covers). Admin hygiene;
 * reports how many objects were removed.
 */
export async function cleanupOrphanImagesAction(formData: FormData): Promise<void> {
  await assertAdmin();

  const productId = formData.get("productId")?.toString();
  if (!productId) return;

  const client = await getSupabaseAdminClient();

  // URLs currently attached to ANY product (a moved/reused photo must not be
  // deleted), and the objects under this product's prefix.
  const [{ data: attached }, { data: objects }] = await Promise.all([
    client.from("product_images").select("url"),
    client.storage.from(PRODUCT_IMAGES_BUCKET).list(`products/${productId}`, {
      limit: 200,
      sortBy: { column: "name", order: "asc" },
    }),
  ]);
  if (!objects || objects.length === 0) return;

  const attachedUrls = new Set(((attached ?? []) as { url: string }[]).map((row) => row.url));
  const orphanPaths = objects
    .map((object) => `products/${productId}/${object.name}`)
    .filter((path) => !attachedUrls.has(productImageUrl(path)));

  if (orphanPaths.length === 0) return;
  await client.storage.from(PRODUCT_IMAGES_BUCKET).remove(orphanPaths);

  const { data: product } = await client
    .from("products")
    .select("slug")
    .eq("id", productId)
    .maybeSingle<{ slug: string }>();
  revalidateProductSurfaces(product?.slug ?? null);
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

  const client = await getSupabaseAdminClient();

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
    .select("position, url")
    .eq("productId", productId)
    .order("position", { ascending: false });
  const existingRows = (existing ?? []) as { position: number; url: string }[];
  const highest = existingRows[0]?.position ?? -1;
  let nextPosition = highest + 1;

  // Duplicate guard: re-picking the SAME FILE twice in one batch should not
  // attach it twice (a re-upload creates a new object with a new URL, so
  // cross-request duplicates are prevented at selection time instead).
  const seenInBatch = new Set<string>();

  let added = 0;
  const errors: string[] = [];
  try {
    for (const file of files) {
      // Duplicate guard within the batch: identical files (same name+size)
      // are skipped rather than attached twice.
      const dedupeKey = `${file.name}:${file.size}:${file.lastModified}`;
      if (seenInBatch.has(dedupeKey)) {
        errors.push(`"${file.name}" was selected twice — added once.`);
        continue;
      }
      seenInBatch.add(dedupeKey);

      const uploaded = await uploadProductImage(productId, file);
      const { error } = await client.from("product_images").insert({
        id: randomUUID(),
        productId,
        url: uploaded.url,
        alt: `${product.slug} — suit material photo ${nextPosition + 1}`,
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
  // Surface batch warnings (duplicate picks) alongside the success count.
  if (errors.length > 0) {
    return { added, error: errors[0] };
  }
  return { added };
}

/**
 * Reorder gallery images: persists a full ordering (imageId → position 1..n)
 * in one batched update. The primary/cover image stays position 0 and cannot
 * be moved — the gallery only rearranges photos after it.
 */
export async function reorderProductImagesAction(
  _prev: ProductImagesActionState,
  formData: FormData,
): Promise<ProductImagesActionState> {
  await assertAdmin();

  const productId = formData.get("productId")?.toString();
  if (!productId) return { error: "Missing product." };

  // Payload: "order" field repeated as `<position>:<imageId>` pairs.
  const pairs = formData
    .getAll("order")
    .map((value) => value.toString())
    .filter(Boolean);
  if (pairs.length === 0) return { error: "Nothing to reorder." };

  const client = await getSupabaseAdminClient();

  // Verify ownership of every image in one read before writing anything.
  const { data: owned } = await client
    .from("product_images")
    .select("id")
    .eq("productId", productId);
  const ownedIds = new Set(((owned ?? []) as { id: string }[]).map((row) => row.id));

  const updates: { id: string; position: number }[] = [];
  for (const pair of pairs) {
    const [positionStr, imageId] = pair.split(":");
    const position = Number(positionStr);
    // Gallery rows only (position >= 1): the cover is owned by the product
    // form / set-cover action and can never be reordered from here.
    if (!imageId || !ownedIds.has(imageId) || !Number.isInteger(position) || position < 1) {
      return { error: "Invalid image order — please refresh and try again." };
    }
    updates.push({ id: imageId, position });
  }

  // Each update targets a different row and there is no unique constraint on
  // position (verified in the schema), so the writes are independent and run
  // concurrently; failures are counted and reported, successful rows are
  // simply kept.
  const results = await Promise.all(
    updates.map((update) =>
      client
        .from("product_images")
        .update({ position: update.position } as never)
        .eq("id", update.id)
        .eq("productId", productId),
    ),
  );
  const failed = results.filter(({ error }) => error).length;

  if (failed > 0) {
    return { error: `Could not save the new order for ${failed} photo(s). Please retry.` };
  }

  // Slug for storefront revalidation.
  const { data: product } = await client
    .from("products")
    .select("slug")
    .eq("id", productId)
    .maybeSingle<{ slug: string }>();
  revalidateProductSurfaces(product?.slug ?? null);

  return { reordered: true };
}

/**
 * Change the product's cover image: promotes one gallery photo to position 0
 * and resequences the rest (1..n, relative order preserved). No storage
 * objects move — only position columns change — and the resequence also
 * heals duplicate or missing positions from any earlier state.
 *
 * The chosen photo's id arrives in the per-row form's hidden `imageId`
 * input (each row owns its form, so the payload is scoped to that row).
 */
export async function setCoverImageAction(
  _prev: ProductImagesActionState,
  formData: FormData,
): Promise<ProductImagesActionState> {
  await assertAdmin();

  const productId = formData.get("productId")?.toString();
  const imageId = formData.get("imageId")?.toString();
  if (!productId || !imageId) return { error: "Missing product or photo." };

  const client = await getSupabaseAdminClient();

  const { data: rows } = await client
    .from("product_images")
    .select("id, url, position")
    .eq("productId", productId)
    .order("position", { ascending: true });
  const images = (rows ?? []) as { id: string; url: string; position: number }[];

  const target = images.find((image) => image.id === imageId);
  if (!target) return { error: "Photo not found — please refresh and try again." };

  // Resequence: chosen photo → cover (0); every other photo keeps its
  // relative order at 1..n. Only rows whose position actually changes are
  // written, so a clean gallery costs a single UPDATE.
  const others = images.filter((image) => image.id !== imageId);
  const updates: { id: string; position: number }[] = [{ id: target.id, position: 0 }];
  others.forEach((image, index) => {
    if (image.position !== index + 1) {
      updates.push({ id: image.id, position: index + 1 });
    }
  });

  for (const update of updates) {
    const { error } = await client
      .from("product_images")
      .update({ position: update.position } as never)
      .eq("id", update.id)
      .eq("productId", productId);
    if (error) {
      console.error("[admin-product-images] cover change failed:", error);
      return { error: "Could not change the cover photo. Please try again." };
    }
  }

  // Slug for storefront revalidation + the new cover URL for the UI.
  const { data: product } = await client
    .from("products")
    .select("slug")
    .eq("id", productId)
    .maybeSingle<{ slug: string }>();
  revalidateProductSurfaces(product?.slug ?? null);

  return { newCoverUrl: target.url };
}

/** Remove one gallery image: the DB row first, then the storage object. */
export async function deleteProductImageAction(formData: FormData): Promise<void> {
  await assertAdmin();

  const imageId = formData.get("imageId")?.toString();
  const productId = formData.get("productId")?.toString();
  if (!imageId || !productId) return;

  const client = await getSupabaseAdminClient();

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

  // Storage path is derived from the row we just read: the delete below must
  // only run once the URL is captured, or the cleanup target would be lost.
  const storagePath = image.data ? productImagePathFromUrl(image.data.url) : null;

  const { error } = await client.from("product_images").delete().eq("id", imageId);
  if (error) {
    console.error("[admin-product-images] delete failed:", error);
    return;
  }

  // Storage cleanup is best-effort and only for bucket-hosted objects.
  if (storagePath) await deleteProductImage(storagePath);

  revalidateProductSurfaces(product.data?.slug ?? null);
}
