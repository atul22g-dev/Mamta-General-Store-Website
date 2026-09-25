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
  experimental: {
    serverActions: {
      // Server Actions cap request bodies at 1 MB by default, which
      // multi-image product uploads exceed. Client-side optimization keeps
      // 5 photos around 1–2.5 MB; this adds headroom as a safety net.
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      ...(supabaseHostname ? [{ protocol: "https", hostname: supabaseHostname } as const] : []),
    ],
  },
};

export default nextConfig;
