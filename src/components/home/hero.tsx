import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin, Phone } from "lucide-react";

import { GOOGLE_MAPS_URL, siteConfig, siteContact } from "@/config/site";
import { heroImages } from "@/lib/placeholder-data";
import { getNewArrivals } from "@/lib/supabase/catalog";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ImageArea } from "@/components/ui/image-area";

/**
 * Homepage hero: editorial split layout — serif headline and CTAs on the
 * left, a single dress-material image on the right. Mobile-first: the image
 * uses a shorter 4/3 frame on phones (less scrolling before the CTAs) and
 * grows to 4/5 from `sm:` up. Three actions cover every visitor: browse,
 * ask, or navigate — primary CTA full-width, the other two share a row.
 *
 * The photo is a real shop product (latest active item's cover, refreshed
 * with the page's ISR) — the editorial placeholder is only a fallback while
 * the catalog is empty or the database is unreachable.
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
    <section className="bg-background relative overflow-hidden" aria-labelledby="hero-heading">
      <Container className="grid items-center gap-8 py-10 sm:py-16 lg:grid-cols-2 lg:gap-14 lg:py-24">
        {/* Imagery — first in DOM on mobile, optimized LCP image */}
        <div className="relative order-1 lg:order-2">
          <ImageArea
            ratio="4/5"
            className="mx-auto aspect-[4/3] max-w-sm sm:aspect-[4/5] lg:max-w-none"
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
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            {siteConfig.positioning} · Jatwar
          </p>
          <h1
            id="hero-heading"
            className="font-display mt-3 text-4xl leading-tight font-medium tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            Beautiful Unstitched Suit Materials for Every Occasion
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-md text-sm text-pretty leading-relaxed sm:mt-5 sm:text-base lg:mx-0">
            Discover elegant, comfortable and affordable unstitched suit materials from Mamta
            General Store, Jatwar.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/shop">
                Shop Collection
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
                  Directions
                </a>
              </Button>
            </div>
          </div>
          {siteContact.timings && (
            <p className="text-muted-foreground mt-4 text-xs">{siteContact.timings}</p>
          )}
        </div>
      </Container>
    </section>
  );
}
