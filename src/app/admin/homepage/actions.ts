"use server";

import { revalidatePath } from "next/cache";

import { getAdminSession } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  deleteSetting,
  getHeroImageUrl,
  siteMediaPathFromUrl,
  upsertSetting,
  SITE_SETTING_KEYS,
} from "@/lib/supabase/site-settings";

/**
 * Admin mutations for the homepage hero image. Uploads land in the
 * site-media bucket (public read, admin write — migration 0017); the
 * setting stores the public URL. The previous object is removed after a
 * successful replace. Every failure returns a message — never throws.
 */

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_BYTES = 5 * 1024 * 1024; // mirrors the bucket limit
const MIN_EDGE_PX = 400; // hero renders large — reject tiny images

export interface HeroImageState {
  error?: string;
  ok?: boolean;
  imageUrl?: string | null;
}

function heroImageUrl(path: string): string {
  const base = process.env.NEXT_PRIVATE_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/storage/v1/object/public/site-media/${path}`;
}

async function assertAdmin(): Promise<void> {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
}

export async function uploadHeroImageAction(
  _prev: HeroImageState,
  formData: FormData,
): Promise<HeroImageState> {
  await assertAdmin();

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image first." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: "Unsupported image type. Use JPEG, PNG, WebP or AVIF." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Image is larger than 5 MB." };
  }

  // Dimension check: the hero shows large — a tiny image would look broken.
  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
    if (!metadata.width || !metadata.height) {
      return { error: "This file could not be read as an image." };
    }
    if (metadata.width < MIN_EDGE_PX || metadata.height < MIN_EDGE_PX) {
      return {
        error: `Image is too small (${metadata.width}×${metadata.height}). Minimum is ${MIN_EDGE_PX}×${MIN_EDGE_PX} pixels.`,
      };
    }
  } catch {
    // sharp unavailable/unreadable — let the upload proceed; the browser
    // already did a lighter validation at selection time.
  }

  const client = await getSupabaseAdminClient();

  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/avif"
          ? "avif"
          : "jpg";
  const path = `hero/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error: uploadError } = await client.storage
    .from("site-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    if (/bucket/i.test(uploadError.message)) {
      return {
        error:
          "The site-media bucket is missing — run `npm run db:deploy` on the server to apply migration 0017, then try again.",
      };
    }
    return { error: `Upload failed: ${uploadError.message}` };
  }

  // Capture the previous object for cleanup before overwriting the setting.
  const previousUrl = await getHeroImageUrl();
  const previousPath = siteMediaPathFromUrl(previousUrl);

  const result = await upsertSetting(SITE_SETTING_KEYS.heroImage, heroImageUrl(path));
  if (!result.ok) {
    // Setting write failed — remove the orphaned upload.
    await client.storage.from("site-media").remove([path]);
    return { error: result.error };
  }

  // Best-effort cleanup of the replaced object.
  if (previousPath) {
    await client.storage.from("site-media").remove([previousPath]).catch(() => {});
  }

  revalidatePath("/");
  return { ok: true, imageUrl: heroImageUrl(path) };
}

export async function removeHeroImageAction(
  prev: HeroImageState,
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the useActionState signature */
  _formData: FormData,
): Promise<HeroImageState> {
  void prev;
  await assertAdmin();

  const previousUrl = await getHeroImageUrl();
  const result = await deleteSetting(SITE_SETTING_KEYS.heroImage);
  if (!result.ok) return { error: result.error };

  const previousPath = siteMediaPathFromUrl(previousUrl);
  if (previousPath) {
    await (await getSupabaseAdminClient())
      .storage.from("site-media")
      .remove([previousPath])
      .catch(() => {});
  }

  revalidatePath("/");
  return { ok: true, imageUrl: null };
}
