import Link from "next/link";
import { ArrowRight, MapPin, Phone } from "lucide-react";

import { GOOGLE_MAPS_URL, siteContact } from "@/config/site";
import { heroImages } from "@/lib/placeholder-data";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ImageArea } from "@/components/ui/image-area";

/**
 * Homepage hero: editorial split layout — serif headline and CTAs on the
 * left, layered dress-material imagery on the right. Stacks and centers on
 * mobile. Three actions cover every visitor: browse, ask, or navigate.
 */
export function Hero() {
  return (
    <section className="bg-background relative overflow-hidden" aria-labelledby="hero-heading">
      <Container className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-14 lg:py-24">
        {/* Copy */}
        <div className="animate-fade-up order-2 text-center lg:order-1 lg:text-left">
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Women&apos;s Unstitched Dress Material · Jatwar
          </p>
          <h1
            id="hero-heading"
            className="font-display mt-3 text-4xl leading-tight font-medium tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            Beautiful Unstitched Dress Materials for Every Occasion
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-md text-pretty leading-relaxed lg:mx-0">
            Discover elegant, comfortable and affordable dress materials from Mamta General Store,
            Jatwar.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/shop">
                Shop Collection
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/contact">
                <Phone />
                Contact Us
              </Link>
            </Button>
            <Button size="lg" variant="ghost" asChild className="w-full sm:w-auto">
              <a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer">
                <MapPin />
                Get Directions
              </a>
            </Button>
          </div>
          {siteContact.timings && (
            <p className="text-muted-foreground mt-4 text-xs">{siteContact.timings}</p>
          )}
        </div>

        {/* Imagery */}
        <div className="relative order-1 lg:order-2">
          <ImageArea ratio="4/5" className="mx-auto max-w-sm lg:max-w-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImages.main.url}
              alt={heroImages.main.alt}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </ImageArea>
          <ImageArea
            ratio="1/1"
            className="shadow-soft-lg absolute -bottom-6 -left-2 hidden w-40 sm:block lg:-left-8 lg:w-52"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImages.secondary.url}
              alt={heroImages.secondary.alt}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </ImageArea>
        </div>
      </Container>
    </section>
  );
}
