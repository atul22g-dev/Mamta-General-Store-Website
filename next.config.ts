import type { NextConfig } from "next";

/**
 * Supabase Storage serves product images from the project host
 * (…/object/public/product-images/…). The hostname comes from the Supabase
 * URL env var — no hardcoded project URLs.
 *
 * PRODUCTION NOTE (Vercel): this runs at BUILD time, so the variable must be
 * set in the project's Environment Variables BEFORE the build that ships to
 * production. All three accepted names are checked because the app accepts
 * either naming convention everywhere else (see src/lib/supabase/env.ts).
 */
const supabaseHostname = (() => {
  const url =
    process.env.NEXT_PRIVATE_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL;
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
      // Any Supabase project host — resilient to env-var load order.
      { protocol: "https", hostname: "**.supabase.co" },
      // Exact project host too (covers custom domains/alternate TLDs).
      ...(supabaseHostname && !supabaseHostname.endsWith(".supabase.co")
        ? [{ protocol: "https", hostname: supabaseHostname } as const]
        : []),
    ],
    // Product-image objects are immutable (path embeds a timestamp), so the
    // optimized renditions can be cached far longer than the upstream's
    // default Cache-Control suggests — fewer optimizer invocations on
    // Vercel, faster repeat visits.
    minimumCacheTTL: 86_400,
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
