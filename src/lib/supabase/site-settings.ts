import "server-only";

import { getSupabasePublicClient } from "./public";
import { getSupabaseAdminClient } from "./admin";

/**
 * Site settings data layer — key/value store for storefront surfaces that
 * are not catalog data (migration 0017). The storefront reads (anon, public
 * policy); the admin panel writes (admin-only policies).
 *
 * Graceful schema-lag guard: if migration 0017 has not been applied yet,
 * reads return null (the hero falls back to its placeholder) and writes
 * surface a clear message telling the admin to deploy the migration.
 */

/** Known setting keys. */
export const SITE_SETTING_KEYS = {
  heroImage: "hero_image",
} as const;

/** Postgres error for "the table does not exist yet" (migration pending). */
const MISSING_TABLE = /does not exist/i;

/** The public URL of the homepage hero image, or null when not set. */
export async function getHeroImageUrl(): Promise<string | null> {
  try {
    const { data, error } = await getSupabasePublicClient()
      .from("site_settings")
      .select("value")
      .eq("key", SITE_SETTING_KEYS.heroImage)
      .maybeSingle<{ value: string }>();
    if (error) return null;
    return data?.value ?? null;
  } catch {
    return null;
  }
}

/** Result of an admin settings mutation. */
export interface SettingsMutationResult {
  ok: boolean;
  error?: string;
}

/** Upsert one setting (admin only — enforced by RLS, caller gated too). */
async function upsertSetting(key: string, value: string): Promise<SettingsMutationResult> {
  const { error } = await (await getSupabaseAdminClient())
    .from("site_settings")
    .upsert({ key, value, updatedAt: new Date().toISOString() } as never);
  if (error) {
    if (MISSING_TABLE.test(error.message)) {
      return {
        ok: false,
        error:
          "Site settings are not deployed yet — run `npm run db:deploy` on the server to apply migration 0017, then try again.",
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Delete one setting (admin only). */
async function deleteSetting(key: string): Promise<SettingsMutationResult> {
  const { error } = await (await getSupabaseAdminClient())
    .from("site_settings")
    .delete()
    .eq("key", key);
  if (error) {
    if (MISSING_TABLE.test(error.message)) {
      return {
        ok: false,
        error:
          "Site settings are not deployed yet — run `npm run db:deploy` on the server to apply migration 0017, then try again.",
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Storage path of the current hero image (for cleanup on replace/remove). */
export async function getHeroImagePath(): Promise<string | null> {
  const url = await getHeroImageUrl();
  return siteMediaPathFromUrl(url);
}

/**
 * Extract the site-media storage path from a public URL, or null for
 * external URLs — mirrors productImagePathFromUrl in storage.ts.
 */
export function siteMediaPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = "/object/public/site-media/";
  const index = url.indexOf(marker);
  return index === -1 ? null : url.slice(index + marker.length);
}

export { upsertSetting, deleteSetting };
