import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/constants";

/**
 * Central business + site configuration. This is the single source of truth
 * for the shop's identity: metadata, location, contact channels and the
 * India Post delivery story shown across the storefront.
 *
 * `siteUrl` comes from NEXT_PUBLIC_SITE_URL and is used for canonical URLs,
 * metadataBase, sitemap.xml and robots.txt.
 */
export const siteConfig = {
  name: SITE_NAME,
  tagline: SITE_TAGLINE,
  description: SITE_DESCRIPTION,
  locale: "en_IN",
  keywords: [
    "Mamta General Store",
    "unstitched suit material",
    "women's suit material Jatwar",
    "suit material shop Jatwar",
    "suit material near Jatwar",
    "women's ethnic wear",
    "salwar suit material",
    "suit material with dupatta",
    "Ambala suit material shop",
    "India Post delivery",
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

/** Public site URL without a trailing slash. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);

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
