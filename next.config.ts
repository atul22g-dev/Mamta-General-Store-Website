import type { NextConfig } from "next";

/**
 * Supabase Storage serves product images from the project host
 * (…/object/public/product-images/…). The hostname comes from the
 * NEXT_PUBLIC_SUPABASE_URL env var — no hardcoded project URLs.
 */
const supabaseHostname = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      ...(supabaseHostname ? [{ protocol: "https", hostname: supabaseHostname } as const] : []),
    ],
  },
};

export default nextConfig;
