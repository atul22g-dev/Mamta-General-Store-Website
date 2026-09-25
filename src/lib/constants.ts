/**
 * Store-wide constants. Edit here — no need to touch components.
 * Keep values in one place so new categories/pages stay consistent.
 */

export const SITE_NAME = "Mamta General Store";

export const SITE_TAGLINE = "Women's Unstitched Suit Materials";

export const SITE_DESCRIPTION =
  "Women's unstitched suit materials with dupatta at Mamta General Store, Jatwar — a variety of fabrics, colours and designs. Visit our local shop or order by India Post.";

/**
 * Categories live in the database (`categories` table) — nothing static here.
 * The storefront reads them via `lib/supabase/catalog.ts`.
 */

/** Default currency for all prices (stored in minor units, e.g. paise). */
export const DEFAULT_CURRENCY = "INR";
