import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_POSITIONING,
  SITE_TAGLINE,
} from "@/lib/constants";

/**
 * Central business + site configuration. This is the single source of truth
 * for the shop's identity: metadata, location, contact channels and the
 * general-store story shown across the storefront.
 *
 * `siteUrl` comes from NEXT_PUBLIC_SITE_URL and is used for canonical URLs,
 * metadataBase, sitemap.xml and robots.txt.
 */
export const siteConfig = {
  name: SITE_NAME,
  tagline: SITE_TAGLINE,
  /** Store-level positioning line (accuracy rules in lib/constants.ts). */
  positioning: SITE_POSITIONING,
  description: SITE_DESCRIPTION,
  locale: "en_IN",
  keywords: [
    "Mamta General Store",
    "general store Jatwar",
    "general store near Jatwar",
    "school supplies Jatwar",
    "stationery shop Jatwar",
    "school bags Jatwar",
    "household items Jatwar",
    "toys and games Jatwar",
    "personal care products Jatwar",
    "Ambala district general store",
  ],
} as const;

/**
 * The physical shop's Google Maps place — used by "Visit Our Local Shop",
 * Get Directions buttons and the footer. Real location, never replaced with
 * invented data.
 */
export const GOOGLE_MAPS_URL = "https://maps.app.goo.gl/YoC5KUXBHETsjzJy9";

/** Delivery method shown across the storefront and checkout. */
export const DELIVERY_NOTE = "Delivered across India by India Post";

/** The shop's full postal address, as displayed in the local-shop section. */
export const SHOP_ADDRESS = "Mamta General Store, Near Post Office, Jatwar, Haryana 134201, India";

/**
 * The shop's real production origin — last-resort fallback so a production
 * build can never fail (or silently emit localhost canonicals) over a
 * missing env var. Update here if the site moves to a custom domain.
 */
const FALLBACK_PRODUCTION_URL = "https://mamta-general-store.vercel.app";

/**
 * Public site URL without a trailing slash — the base for every canonical
 * URL, Open Graph absolute URL, sitemap entry and robots.txt sitemap link.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL — the explicit, recommended setting.
 *   2. Vercel's auto-injected project/domain vars.
 *   3. The known production origin (warn loudly — set NEXT_PUBLIC_SITE_URL).
 *   4. localhost — `next dev` only.
 */
function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const vercelDomain = (
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    process.env.VERCEL_URL
  )?.trim();
  if (vercelDomain) {
    return `https://${vercelDomain.replace(/\/+$/, "")}`;
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[site] NEXT_PUBLIC_SITE_URL is not set — falling back to " +
        `${FALLBACK_PRODUCTION_URL} for canonical URLs, sitemap.xml, robots.txt ` +
        "and Open Graph tags. Set it explicitly in the hosting environment.",
    );
    return FALLBACK_PRODUCTION_URL;
  }

  return "http://localhost:3000";
}

export const siteUrl = resolveSiteUrl();

/**
 * Contact details for the shop. All values are real; the WhatsApp number
 * shares the shop phone line (wa.me needs the country code, no "+").
 */
export const siteContact: {
  address: string | null;
  phone: string | null;
  email: string | null;
  /** WhatsApp click-to-chat link, or null when unavailable. */
  whatsappUrl: string | null;
  /** Shop timings — "to be added" when null. */
  timings: string | null;
} = {
  address: SHOP_ADDRESS,
  phone: "9729292342",
  email: null,
  whatsappUrl: "https://wa.me/919729292342",
  timings: "Mon – Sun: 9:00 AM – 1:00 PM | 3:00 PM – 8:00 PM",
};
