import type { Metadata } from "next";
import { MapPin, Navigation, Phone, Store } from "lucide-react";

import { GOOGLE_MAPS_URL, siteContact } from "@/config/site";
import { SITE_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

export const metadata: Metadata = {
  title: "About Us",
  description: `${SITE_NAME} is a local shop near the Post Office in Jatwar, Haryana, offering women's unstitched suit materials with dupatta — daily wear, festive and premium collections, delivered across India by India Post.`,
  alternates: { canonical: "/about" },
  openGraph: {
    title: `About Us — ${SITE_NAME}`,
    description: `${SITE_NAME} is a local shop near the Post Office in Jatwar, Haryana, offering women's unstitched suit materials with dupatta — delivered across India by India Post.`,
    type: "website",
    url: "/about",
  },
};

/** About the local shop — a modern editorial layout with only verifiable facts. */
export default function AboutPage() {
  return (
    <Container className="flex flex-1 flex-col py-14 sm:py-20">
      {/* Intro split: copy + action card */}
      <div className="grid items-center gap-10 lg:grid-cols-5 lg:gap-14">
        <div className="lg:col-span-3">
          <SectionHeading
            align="left"
            eyebrow="About Us"
            title="A small Jatwar shop for beautiful unstitched suit materials with dupatta"
            description="Beautiful unstitched suit materials with dupatta in a variety of fabrics, colours and designs — so you can have it tailored exactly the way you like it."
          />
          <div className="text-muted-foreground mt-5 space-y-4 text-sm leading-relaxed sm:text-base">
            <p>
              From breathable cottons for daily wear to printed, embroidered and premium fabrics for
              festive occasions, every material is checked by hand before it reaches the shelf.
            </p>
            <p>
              Visit the shop to see and feel the fabrics yourself, or browse the collection here —
              we&apos;ll pack your order carefully and send it by India Post.
            </p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-card rounded-2xl border p-6 shadow-soft sm:p-8">
            <span className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-full">
              <Store aria-hidden="true" className="size-5" />
            </span>
            <p className="font-display mt-4 text-lg font-medium">Mamta General Store</p>
            <p className="text-muted-foreground mt-1 flex items-start gap-1.5 text-sm">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {siteContact.address}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button asChild className="w-full">
                <a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer">
                  <Navigation aria-hidden="true" />
                  Get Directions
                </a>
              </Button>
              {siteContact.phone && (
                <Button variant="outline" asChild className="w-full">
                  <a href={`tel:${siteContact.phone}`}>
                    <Phone aria-hidden="true" />
                    Call the shop
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Three quiet fact cards */}
      <div className="mt-12 grid gap-4 sm:grid-cols-3 sm:gap-6">
        {[
          {
            title: "Unstitched Suit Materials",
            text: "Suit fabric with dupatta, available in a variety of fabrics and designs — ready for tailoring.",
          },
          {
            title: "Checked by hand",
            text: "Fabric, work and finish inspected before anything reaches the shelf.",
          },
          {
            title: "Across India",
            text: "Order from anywhere — packed carefully and sent by India Post.",
          },
        ].map(({ title, text }) => (
          <div key={title} className="bg-card rounded-2xl border p-6">
            <h2 className="font-display text-base font-medium">{title}</h2>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{text}</p>
          </div>
        ))}
      </div>

      {/* Closing CTA strip */}
      <div className="bg-primary mt-12 flex flex-col items-center gap-4 rounded-2xl px-6 py-10 text-center text-primary-foreground sm:flex-row sm:justify-between sm:text-left">
        <p className="font-display text-xl font-medium tracking-tight sm:text-2xl">
          Browse the current collection
        </p>
        <Button
          variant="secondary"
          asChild
          className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
        >
          <a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer" className="contents">
            Find us on Google Maps
          </a>
        </Button>
      </div>
    </Container>
  );
}
