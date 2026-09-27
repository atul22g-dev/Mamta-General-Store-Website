import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin, Phone, Sparkles } from "lucide-react";

import { GOOGLE_MAPS_URL, siteContact } from "@/config/site";
/**
 * Hero fallback imagery (generic retail-aisle placeholder). The homepage
 * hero otherwise shows a real shop product; this single Unsplash image
 * renders while the catalog is empty or the database is unreachable.
 */
const heroImages = {
  main: {
    url: "https://images.unsplash.com/photo-1534723452862-4c874018d66d?q=80&w=1200&auto=format&fit=crop",
    alt: "Aisles of everyday products in a retail store",
  },
};
import { getNewArrivals } from "@/lib/supabase/catalog";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ImageArea } from "@/components/ui/image-area";

/**
 * Homepage hero: modern split layout — bold geometric headline, pill eyebrow
 * badge and CTAs on the left, product image in a rounded frame with a soft
 * brand-tinted glow behind it on the right. Mobile-first: the image uses a
 * shorter 4/3 frame on phones (less scrolling before the CTAs) and grows to
 * 4/5 from `sm:` up. Three actions cover every visitor: browse, ask, or
 * navigate — primary CTA full-width, the other two share a row.
 *
 * The photo is a real shop product (latest active item's cover, refreshed
 * with the page's ISR) — the placeholder is only a fallback while the
 * catalog is empty or the database is unreachable.
 */
export async function Hero() {
  let heroSrc = heroImages.main.url;
  let heroAlt = heroImages.main.alt;
  try {
    const [latest] = await getNewArrivals(1);
    const cover = latest?.images[0];
    if (latest && cover) {
      heroSrc = cover.url;
      heroAlt = cover.alt ?? latest.name;
    }
  } catch {
    // Keep the placeholder — the hero must never break the homepage.
  }
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-heading">
      {/* Soft brand-tinted glow behind the copy (decorative only) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-32 h-64 bg-[radial-gradient(60%_100%_at_50%_100%,var(--color-primary)_0%,transparent_70%)] opacity-[0.07]"
      />
      <Container className="relative grid items-center gap-8 py-10 sm:py-16 lg:grid-cols-2 lg:gap-14 lg:py-24">
        {/* Imagery — first in DOM on mobile, optimized LCP image */}
        <div className="relative order-1 lg:order-2">
          {/* Glow plate behind the image frame */}
          <div
            aria-hidden="true"
            className="bg-primary/10 absolute -inset-4 -z-10 rounded-[2rem] blur-2xl sm:-inset-6"
          />
          <ImageArea
            ratio="4/5"
            className="mx-auto aspect-[4/3] max-w-sm shadow-soft-lg sm:aspect-[4/5] lg:max-w-none"
          >
            <Image
              src={heroSrc}
              alt={heroAlt}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, (min-width: 640px) 384px, calc(100vw - 2rem)"
              className="object-cover"
            />
          </ImageArea>
        </div>

        {/* Copy */}
        <div className="animate-fade-up order-2 text-center lg:order-1 lg:text-left">
          <p className="bg-accent text-accent-foreground inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Mamta General Store · Jatwar
          </p>
          <h1
            id="hero-heading"
            className="font-display mt-4 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            Everything You Need,{" "}
            <span className="text-primary">Every Day</span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-md text-sm leading-relaxed text-pretty sm:mt-5 sm:text-base lg:mx-0">
            From school supplies and bags to footwear, personal-care products, toys, accessories
            and everyday household items — a wide variety of useful products under one roof.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
            <Button size="lg" asChild className="w-full shadow-soft sm:w-auto">
              <Link href="/shop">
                Explore Products
                <ArrowRight />
              </Link>
            </Button>
            <div className="grid grid-cols-2 gap-3 sm:flex sm:w-auto">
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/contact">
                  <Phone />
                  Contact Us
                </Link>
              </Button>
              <Button size="lg" variant="ghost" asChild className="w-full sm:w-auto">
                <a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer">
                  <MapPin />
                  Visit Our Store
                </a>
              </Button>
            </div>
          </div>
          {siteContact.timings && (
            <p className="text-muted-foreground mt-4 inline-flex items-center gap-2 text-xs">
              <span aria-hidden="true" className="bg-emerald-500 size-1.5 rounded-full" />
              {siteContact.timings}
            </p>
          )}
        </div>
      </Container>
    </section>
  );
}
