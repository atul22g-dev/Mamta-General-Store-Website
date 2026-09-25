import { unsplash } from "@/lib/images";

/**
 * Hero fallback imagery (fashion editorial placeholders).
 *
 * Product catalog data comes from Supabase (`lib/supabase/catalog.ts`).
 * This single image is the homepage hero's fallback while the catalog is
 * empty or the database is unreachable — the hero otherwise shows a real
 * shop product.
 */

/** Hero fallback imagery (fashion editorial placeholder). */
export const heroImages = {
  main: {
    url: unsplash("photo-1591369822096-ffd140ec948f", 1200),
    alt: "Woman wearing an elegant traditional suit",
  },
};
