import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/site";
import { categoryRegistry } from "@/config/categories";

/** Product URLs refresh from the database hourly. */
export const revalidate = 3600;

/**
 * Dynamic sitemap. Static + registry category URLs always resolve; product
 * URLs come from the database and are skipped gracefully if it is unreachable.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/shop`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/categories`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const categoryPages: MetadataRoute.Sitemap = categoryRegistry.map((category) => ({
    url: `${siteUrl}/category/${category.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  let productPages: MetadataRoute.Sitemap = [];
  try {
    const { getShopProducts } = await import("@/lib/supabase/catalog");
    const products = await getShopProducts({ limit: 1000 });
    productPages = products.map((product) => ({
      url: `${siteUrl}/products/${product.slug}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch (error) {
    // Sitemap must never fail the build/request because the DB is down.
    console.error("[sitemap] product URLs skipped:", error);
  }

  return [...staticEntries, ...categoryPages, ...productPages];
}
