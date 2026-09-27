import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GOOGLE_MAPS_URL, siteContact, siteConfig, siteUrl } from "@/config/site";
import { JsonLd } from "@/components/seo/json-ld";
import "./globals.css";

/** Clean, neutral body typeface — highly legible on mobile. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/** Elegant serif for display headings — the general-store voice. */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

/** Mobile browser chrome: theme color matches the warm off-white base. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      "max-image-preview": "large",
    },
  },
};

/** Local-business structured data: helps local search surface the shop. */
const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "GeneralStore",
  name: siteConfig.name,
  description: siteConfig.description,
  url: siteUrl,
  telephone: siteContact.phone ? `+91${siteContact.phone}` : undefined,
  email: siteContact.email ?? undefined,
  address: {
    "@type": "PostalAddress",
    streetAddress: "Near Post Office, Jatwar",
    addressLocality: "Jatwar",
    addressRegion: "Haryana",
    postalCode: "134201",
    addressCountry: "IN",
  },
  hasMap: GOOGLE_MAPS_URL,
  openingHours: siteContact.timings ?? undefined,
  priceRange: "₹₹",
};

/**
 * Sitewide search action: adds a Google Sitelinks search box candidate and
 * tells crawlers how search works on this site.
 */
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  url: siteUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

/**
 * Root layout: document shell (fonts, metadata, skip link) only.
 * Storefront chrome (header/footer) lives in the (storefront) route group so
 * the admin area keeps its own, separate layout.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} h-full antialiased`}>
      {/*
        suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
        attributes like data-gr-ext-installed into <body> before React
        hydrates; this silences that one-element attribute noise without
        masking real hydration bugs deeper in the tree.
      */}
      <body suppressHydrationWarning className="flex min-h-full flex-col font-sans">
        <a
          href="#main-content"
          className="focus:bg-background sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 focus:text-sm focus:shadow-soft"
        >
          Skip to content
        </a>
        {children}
        {/*
          Vercel Web Analytics: no-ops in local dev and on non-Vercel hosts;
          collects page views in production once deployed on Vercel.
        */}
        <Analytics />
        {/*
          Vercel Speed Insights: samples real-user Core Web Vitals (LCP, INP,
          CLS) in production on Vercel; no-ops in local dev.
        */}
        <SpeedInsights />
        {/* Structured data for local + sitewide SEO (XSS-safe JSON-LD). */}
        <JsonLd data={localBusinessJsonLd} />
        <JsonLd data={websiteJsonLd} />
      </body>
    </html>
  );
}
