import Link from "next/link";
import { Mail, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";

import { GOOGLE_MAPS_URL, siteContact } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * Homepage contact band: everything a customer needs to reach the shop —
 * large, tappable actions (call / WhatsApp / directions) and the real
 * contact details. Timings render only when configured.
 */
export function ContactBand() {
  return (
    <section
      id="contact-band"
      className="border-t py-16 sm:py-20"
      aria-labelledby="contact-band-heading"
    >
      <Container className="flex flex-col items-center text-center">
        <SectionHeading
          align="center"
          eyebrow="Contact"
          title="Get in touch"
          description="Ask about availability, prices or anything else — we're happy to help."
        />

        {/* Mobile-first CTA stack: call is primary and full-width; WhatsApp
            and Directions share a row so the band stays compact on phones. */}
        <div className="mt-8 w-full max-w-md space-y-3 sm:max-w-none">
          {siteContact.phone && (
            <Button size="lg" asChild className="w-full">
              <a href={`tel:${siteContact.phone}`}>
                <Phone />
                Call {siteContact.phone}
              </a>
            </Button>
          )}
          <div className="grid grid-cols-2 gap-3">
            {siteContact.whatsappUrl && (
              <Button size="lg" variant="outline" asChild className="w-full">
                <a href={siteContact.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle />
                  WhatsApp
                </a>
              </Button>
            )}
            <Button size="lg" variant="ghost" asChild className="w-full">
              <a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer">
                <Navigation />
                Directions
              </a>
            </Button>
          </div>
        </div>

        <ul className="text-muted-foreground mt-10 space-y-2.5 text-sm">
          <li className="flex items-start justify-center gap-2">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {siteContact.address ?? SHOP_ADDRESS_FALLBACK}
          </li>
          {siteContact.email && (
            <li className="flex items-center justify-center gap-2">
              <Mail aria-hidden="true" className="size-4 shrink-0" />
              <a href={`mailto:${siteContact.email}`} className="hover:text-foreground">
                {siteContact.email}
              </a>
            </li>
          )}
          {siteContact.timings && (
            <li className="flex items-center justify-center gap-2">
              Timings: {siteContact.timings}
            </li>
          )}
        </ul>

        <p className="text-muted-foreground mt-8 text-sm">
          <Link href="/contact" className="text-foreground hover:underline">
            All contact details →
          </Link>
        </p>
      </Container>
    </section>
  );
}

const SHOP_ADDRESS_FALLBACK = "Jatwar, Haryana";
