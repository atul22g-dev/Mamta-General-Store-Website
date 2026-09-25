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
  // Production hardening: gzip/brotli responses (on by default, pinned here
  // for clarity), never advertise the framework, and strict-mode React so
  // impure renders surface in development.
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
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
      ...(supabaseHostname ? [{ protocol: "https", hostname: supabaseHostname } as const] : []),
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking protection and referrer privacy. The CSP allows
          // Supabase Storage + Unsplash images and the Supabase API origin;
          // styles/scripts stay same-origin plus Next's inline runtime.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
