import { unsplash } from "@/lib/images";

/**
 * Hero imagery (fashion editorial placeholders).
 *
 * Product catalog data now comes from Supabase (`lib/supabase/catalog.ts`).
 * These two images remain homepage presentation placeholders — not catalog
 * data — until real brand photography is available.
 */

/** Hero imagery (fashion editorial placeholders). */
export const heroImages = {
  main: {
    url: unsplash("photo-1591369822096-ffd140ec948f", 1200),
    alt: "Woman wearing an elegant traditional suit",
  },
  secondary: {
    url: unsplash("photo-1515372039744-b8f02a3ae446", 600),
    alt: "Detail of a stylish outfit",
  },
};
