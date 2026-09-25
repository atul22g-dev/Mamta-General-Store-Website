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

/**
 * Flat shipping charge per order, in paise (₹100). Display-only source of
 * truth: the order itself is calculated by the place_order RPC (migration
 * 0015), which stores the same value — keep the two in sync.
 */
export const FLAT_SHIPPING_PAISE = 10_000;

/**
 * Per-line quantity cap. The cart UI, localStorage sanitization and the
 * checkout zod schema all enforce 1..MAX_CART_QUANTITY; place_order (RPC)
 * re-validates server-side.
 */
export const MAX_CART_QUANTITY = 99;
