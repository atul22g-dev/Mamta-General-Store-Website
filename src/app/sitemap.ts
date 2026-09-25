import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";
import { getCategories } from "@/lib/supabase/catalog";

/** Product + category URLs refresh from the database hourly. */
export const revalidate = 3600;

/**
 * Dynamic sitemap. Static URLs always resolve; category and product URLs come
 * from the database and are skipped gracefully if it is unreachable.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/shop`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/categories`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.4 },
  ];

  let dbEntries: MetadataRoute.Sitemap = [];
  try {
    const categories = await getCategories();
    const categoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
      url: `${siteUrl}/category/${category.slug}`,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const { getShopProducts } = await import("@/lib/supabase/catalog");
    const products = await getShopProducts({ limit: 1000 });
    const productPages: MetadataRoute.Sitemap = products.map((product) => ({
      url: `${siteUrl}/products/${product.slug}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    dbEntries = [...categoryPages, ...productPages];
  } catch (error) {
    // Sitemap must never fail the build/request because the DB is down.
    console.error("[sitemap] database URLs skipped:", error);
  }

  return [...staticEntries, ...dbEntries];
}
