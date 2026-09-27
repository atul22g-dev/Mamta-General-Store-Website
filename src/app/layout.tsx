import type { Metadata, Viewport } from "next";
import { Outfit, Work_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GOOGLE_MAPS_URL, siteContact, siteConfig, siteUrl } from "@/config/site";
import { JsonLd } from "@/components/seo/json-ld";
import "./globals.css";

/** Geometric display typeface — modern, friendly headlines. */
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

/** Clean body typeface — highly legible on mobile. */
const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

/** Mobile browser chrome: theme color matches the warm off-white base. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
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

/**
 * Local-business structured data — the single most valuable SEO asset for a
 * physical shop. Feeds Google's local pack / knowledge panel: geo coordinates
 * for "near me" ranking, fully specified opening hours (better than the
 * display string), sameAs links to tie the site to its Maps place, and
 * areaServed so nearby-town queries can surface the store.
 */
const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "GeneralStore",
  "@id": `${siteUrl}/#store`,
  name: siteConfig.name,
  description: siteConfig.description,
  url: siteUrl,
  telephone: siteContact.phone ? `+91${siteContact.phone}` : undefined,
  email: siteContact.email ?? undefined,
  image: `${siteUrl}/icon.png`,
  logo: `${siteUrl}/icon.png`,
  address: {
    "@type": "PostalAddress",
    streetAddress: "Near Post Office, Jatwar",
    addressLocality: "Jatwar",
    addressRegion: "Haryana",
    postalCode: "134201",
    addressCountry: "IN",
  },
  geo: {
    "@type": "GeoCoordinates",
    // Jatwar, Haryana 134201 — locality-level coordinates; refine to the
    // exact shop pin when the owner confirms them.
    latitude: 30.2887,
    longitude: 77.0142,
  },
  hasMap: GOOGLE_MAPS_URL,
  sameAs: [GOOGLE_MAPS_URL],
  areaServed: [
    { "@type": "City", name: "Jatwar" },
    { "@type": "City", name: "Naraingarh" },
    { "@type": "City", name: "Ambala" },
  ],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "09:00",
      closes: "13:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "15:00",
      closes: "20:00",
    },
  ],
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
    <html lang="en" className={`${outfit.variable} ${workSans.variable} h-full antialiased`}>
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
