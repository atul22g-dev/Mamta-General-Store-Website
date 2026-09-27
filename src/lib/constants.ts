/**
 * Store-wide constants. Edit here — no need to touch components.
 * Keep values in one place so new categories/pages stay consistent.
 */

export const SITE_NAME = "Mamta General Store";

export const SITE_TAGLINE = "Your Local General Store in Jatwar";

/**
 * Store positioning — the ONE description of what this business is.
 *
 * Accuracy rules (content audit):
 * - Mamta General Store is a LOCAL GENERAL STORE serving Jatwar and nearby
 *   customers with a wide variety of everyday products. Never describe the
 *   business as a suit-material, fabric or women's-clothing specialist.
 * - Category examples (school essentials, stationery, bags, footwear,
 *   personal care, toys, household items…) are illustrative: phrase them
 *   with "including / a variety of / depending on stock" — never as a
 *   guarantee that every product is available.
 * - Individual product pages speak only from the database (name/description),
 *   never from these constants.
 */
export const SITE_POSITIONING_SHORT = "Your local general store in Jatwar, Haryana";

export const SITE_POSITIONING =
  "A local general store serving Jatwar and nearby customers with a wide variety of everyday products";

export const SITE_DESCRIPTION =
  "Mamta General Store in Jatwar, Haryana offers a variety of everyday products including school essentials, stationery, bags, footwear, personal-care items, toys, accessories, household products and more.";

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
