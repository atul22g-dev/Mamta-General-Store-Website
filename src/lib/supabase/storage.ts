import "server-only";

import { getSupabaseAdminClient } from "./admin";
import { supabaseUrl } from "./env";

/**
 * Product-image storage helpers (Supabase Storage).
 *
 * Convention: one public bucket, objects named
 * `products/<productId>/<timestamp>-<slug>.<ext>` so all images for a product
 * live under one prefix and can be replaced/removed per product.
 *
 * Uploads run under the signed-in admin's session (RLS storage policies in
 * migration 0007 authorize them) — there is no service-role key in this app.
 * Callers receive a plain public URL to store in `product_images.url`.
 */

export const PRODUCT_IMAGES_BUCKET = "product-images";

/** 5 MB upload cap (mirrors the bucket-level limit in migration 0004). */
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Content-type allow-list for product images. */
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

/**
 * Public URL for an object in the product-images bucket — pure URL math on
 * the project host, no client needed (and therefore no request scope).
 */
export function productImageUrl(path: string): string {
  const base = supabaseUrl().replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${path}`;
}

/**
 * Extract the storage path from a public URL produced by this bucket
 * (`…/object/public/product-images/<path>`), or null for external URLs.
 */
export function productImagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${PRODUCT_IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length);
}

export interface UploadResult {
  url: string;
  path: string;
}

/**
 * Upload a product image (server-side) and return its public URL.
 * Throws with a readable message on invalid type, size, or upload failure.
 */
export async function uploadProductImage(productId: string, file: File): Promise<UploadResult> {
  // Type validation: allow-list only, never trust the extension.
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(
      `Unsupported image type: ${file.type || "unknown"}. Use JPEG, PNG, WebP or AVIF.`,
    );
  }

  // Size validation (also enforced by the bucket itself).
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error("Image is larger than 5 MB.");
  }
  if (file.size === 0) {
    throw new Error("The selected file is empty.");
  }

  const admin = await getSupabaseAdminClient();

  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/avif"
          ? "avif"
          : "jpg";
  const path = `products/${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await admin.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(`Image upload failed: ${error.message}`);

  return { url: productImageUrl(path), path };
}

/** Delete one image object by its storage path (best-effort, never throws). */
export async function deleteProductImage(path: string): Promise<void> {
  if (!path) return;
  try {
    const { error } = await (
      await getSupabaseAdminClient()
    ).storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove([path]);
    if (error) throw new Error(error.message);
  } catch (error) {
    // Storage cleanup must never break the admin flow; log and continue.
    console.error("[product-image-cleanup]", path, error);
  }
}

/** Delete every image under a product's prefix (best-effort, never throws). */
export async function deleteAllProductImages(productId: string): Promise<void> {
  try {
    const admin = await getSupabaseAdminClient();
    const { data, error } = await admin.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .list(`products/${productId}`, { limit: 100, sortBy: { column: "name", order: "asc" } });

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return;

    const paths = data.map((object) => `products/${productId}/${object.name}`);
    const { error: removeError } = await admin.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths);
    if (removeError) throw new Error(removeError.message);
  } catch (error) {
    // Best-effort cleanup; orphaned objects are harmless and loggable.
    console.error(`[product-image-cleanup] products/${productId}`, error);
  }
}
