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
  type UploadResult,
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
    sku: formData.get("sku"),
    description: formData.get("description") ?? "",
    price: formData.get("price"),
    discountPrice: formData.get("discountPrice"),
    // Inventory radio: absent (never checked) → untracked via schema default.
    stockMode: formData.get("stockMode") ?? undefined,
    stock: formData.get("stock"),
    imageUrl: formData.get("imageUrl"),
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

  // Image resolution: uploaded files (up to 5) win; otherwise the URL field
  // becomes the cover. Exactly one of the two is required.
  const imageFilesRaw = formData
    .getAll("imageFiles")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const imageFiles = imageFilesRaw.slice(0, 5);
  const hasFile = imageFiles.length > 0;

  if (!hasFile && !data.imageUrl) {
    return {
      errors: {
        imageUrl: [
          imageFilesRaw.length > 5
            ? `Up to 5 images can be uploaded (received ${imageFilesRaw.length}).`
            : "Upload an image file or provide an image URL",
        ],
      },
    };
  }

  // Auto-slug from the name when left blank.
  const slug = data.slug || slugifyName(data.name);

  const { slugTaken, skuTaken } = await slugOrSkuTaken(slug, data.sku, id);
  if (slugTaken) {
    return {
      errors: {
        slug: ["This slug is already in use"],
      },
    };
  }
  if (skuTaken) {
    return {
      errors: {
        sku: ["This SKU is already in use by another product"],
      },
    };
  }

  const productValues = toDatabaseValues(data);
  const client = await getSupabaseAdminClient();

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

    // 1. Upload the files (if any) — before any database writes so a failed
    //    upload leaves the product data untouched. Uploads are independent —
    //    start them together instead of one after another. allSettled (not
    //    all) so a single failed upload still lets us roll back every object
    //    that DID reach storage.
    let coverUrl: string | null = null;
    let coverPath: string | null = null;
    const extraUploads: UploadResult[] = [];
    if (hasFile) {
      try {
        const settled = await Promise.allSettled(
          imageFiles.map((file) => uploadProductImage(productId, file)),
        );
        const firstRejection = settled.find(
          (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected",
        );
        if (firstRejection) throw firstRejection.reason;
        settled.forEach((outcome, index) => {
          const uploaded = (outcome as PromiseFulfilledResult<UploadResult>).value;
          if (index === 0) {
            coverUrl = uploaded.url;
            coverPath = uploaded.path;
          } else {
            extraUploads.push(uploaded);
          }
        });
      } catch (uploadError) {
        const rollbackPaths = [coverPath, ...extraUploads.map((u) => u.path)].filter(
          (path): path is string => Boolean(path),
        );
        // Cleanup targets are independent objects — remove them together.
        await Promise.all(rollbackPaths.map((path) => deleteProductImage(path)));
        console.error("[admin-products] image upload failed:", uploadError);
        return {
          formError:
            uploadError instanceof Error
              ? uploadError.message
              : "Image upload failed. Please try again.",
        };
      }
    }

    const imageUrl = coverUrl ?? data.imageUrl ?? null;

    if (id) {
      // 2a. Update the product row.
      const { error: updateError } = await client
        .from("products")
        .update(productValues as never)
        .eq("id", id);
      if (updateError) throw updateError;

      // 3a. Replace the primary image row (position 0), then append the
      //      extra uploads to the gallery (positions 1–4).
      const { error: imageDeleteError } = await client
        .from("product_images")
        .delete()
        .eq("productId", id)
        .eq("position", 0);
      if (imageDeleteError) throw imageDeleteError;
      const galleryRows = [
        { id: randomUUID(), productId: id, url: imageUrl, alt: data.name, position: 0 },
        ...extraUploads.map((upload, index) => ({
          id: randomUUID(),
          productId: id,
          url: upload.url,
          alt: `${data.name} — photo ${index + 2}`,
          position: index + 1,
        })),
      ];
      const { error: imageInsertError } = await client
        .from("product_images")
        .insert(galleryRows as never);
      if (imageInsertError) throw imageInsertError;
    } else {
      // 2b. Create the product with the pre-generated id.
      const { error: insertError } = await client
        .from("products")
        .insert({ id: productId, ...productValues } as never);
      if (insertError) throw insertError;

      // 3b. Insert the gallery: cover at position 0, extras at 1–4.
      const galleryRows = [
        { id: randomUUID(), productId, url: imageUrl, alt: data.name, position: 0 },
        ...extraUploads.map((upload, index) => ({
          id: randomUUID(),
          productId,
          url: upload.url,
          alt: `${data.name} — photo ${index + 2}`,
          position: index + 1,
        })),
      ];
      const { error: imageInsertError } = await client
        .from("product_images")
        .insert(galleryRows as never);
      if (imageInsertError) throw imageInsertError;
    }

    // 4. Cleanup: remove the replaced storage object only after the database
    //    is consistent (only when a new file replaced an uploaded image).
    if (id && coverPath && previousImageUrl) {
      const previousPath = productImagePathFromUrl(previousImageUrl);
      if (previousPath) {
        await deleteProductImage(previousPath);
      }
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      // The pre-check above normally catches this; keep a correct message
      // for the race window (another save landed between check and insert).
      return { formError: "A product with this slug or SKU already exists." };
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
    const { error } = await (await getSupabaseAdminClient()).from("products").delete().eq("id", id);
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
    const { error } = await (
      await getSupabaseAdminClient()
    )
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
    const { error } = await (
      await getSupabaseAdminClient()
    )
      .from("products")
      .update({ featured: next } as never)
      .eq("id", id);
    if (error) throw error;
  } catch {
    // Non-fatal, as before.
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/shop");
}
