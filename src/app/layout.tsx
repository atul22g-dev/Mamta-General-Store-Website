import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { GOOGLE_MAPS_URL, SHOP_ADDRESS, siteContact, siteConfig, siteUrl } from "@/config/site";
import "./globals.css";

/** Clean, neutral body typeface — highly legible on mobile. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/** Elegant serif for display headings — the fashion-store voice. */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

/** Local-business structured data: helps local search surface the shop. */
const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "ClothingStore",
  name: siteConfig.name,
  description: siteConfig.description,
  url: siteUrl,
  telephone: siteContact.phone ? `+91${siteContact.phone}` : undefined,
  email: siteContact.email ?? undefined,
  address: {
    "@type": "PostalAddress",
    streetAddress: SHOP_ADDRESS,
    addressLocality: "Jatwar",
    addressRegion: "Haryana",
    postalCode: "134201",
    addressCountry: "IN",
  },
  hasMap: GOOGLE_MAPS_URL,
  priceRange: "₹₹",
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
        <script
          type="application/ld+json"
          // Structured data for local SEO; `<` is escaped so no user-supplied
          // string can close the script element early (XSS-safe JSON-LD).
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessJsonLd).replace(/</g, "\\u003c"),
          }}
        />
      </body>
    </html>
  );
}
