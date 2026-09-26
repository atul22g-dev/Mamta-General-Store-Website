/**
 * Client-side product-image optimization (browser only).
 *
 * Runs at file-selection time in the admin forms, before anything reaches the
 * server: photos are downscaled to at most 1600px on the long edge and
 * re-encoded (WebP/PNG, quality 0.82), which typically turns multi-megabyte
 * camera photos into a few hundred kilobytes. That keeps Server Action
 * payloads comfortably under next.config's bodySizeLimit and makes storefront
 * pages load faster.
 *
 * The canvas APIs only exist in the browser; nothing touches them at import
 * time, so importing this module from client components is safe.
 */

/** Longest edge of the optimized image, in pixels. */
const MAX_EDGE_PX = 1600;

/** Re-encode quality for lossy formats (ignored for PNG). */
const OUTPUT_QUALITY = 0.82;

/** Files at or below this size are passed through untouched. */
const SKIP_BELOW_BYTES = 300 * 1024;

/** Originals already small enough that re-encoding is not worth it. */
const SKIP_REENCODE_BELOW_BYTES = 1.5 * 1024 * 1024;

/**
 * Largest original we accept for processing — camera photos are typically
 * well under this; the per-file upload cap (5 MB) applies to the optimized
 * result, not to the original.
 */
export const PRODUCT_IMAGE_INPUT_MAX_BYTES = 25 * 1024 * 1024;

function extensionForType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

/** Rename the file so its extension matches the re-encoded type. */
function renamedFileName(file: File, type: string): string {
  return `${file.name.replace(/\.[^.]+$/, "")}.${extensionForType(type)}`;
}

/**
 * Optimize one image file. Returns the original file untouched when it is
 * small enough, cannot be decoded, or when re-encoding would not shrink it
 * (e.g. a browser that cannot encode the target type). Never throws.
 */
export async function compressImageFile(file: File): Promise<File> {
  if (typeof window === "undefined" || typeof createImageBitmap !== "function") return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= SKIP_BELOW_BYTES || file.size > PRODUCT_IMAGE_INPUT_MAX_BYTES) return file;

  try {
    // Decodes with EXIF orientation applied, so portraits come out upright.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));

      // No downscaling needed and the file is already small — keep it.
      if (scale === 1 && file.size <= SKIP_REENCODE_BELOW_BYTES) return file;

      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return file;
      context.drawImage(bitmap, 0, 0, width, height);

      // PNG/WebP keep their type so transparency survives; other formats
      // (JPEG, AVIF — which browsers cannot encode) become WebP.
      const targetType =
        file.type === "image/png" || file.type === "image/webp" ? file.type : "image/webp";

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, targetType, OUTPUT_QUALITY),
      );

      // The browser refused the target type (older Safari cannot encode
      // WebP and silently returns PNG) or the result is not an improvement:
      // keep the original bytes either way.
      if (!blob || (targetType !== "image/png" && blob.type !== targetType)) return file;
      if (blob.size >= file.size) return file;

      return new File([blob], renamedFileName(file, blob.type), { type: blob.type });
    } finally {
      bitmap.close();
    }
  } catch {
    // Undecodable file — pass it through and let the server-side upload
    // path surface a proper error.
    return file;
  }
}
