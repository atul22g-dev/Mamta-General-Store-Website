import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";

import { GOOGLE_MAPS_URL, siteContact } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${SITE_NAME}, Jatwar — call, WhatsApp or visit the shop for women's unstitched suit materials with dupatta. Get directions on Google Maps.`,
};

/**
 * Contact page: large, tappable actions first (mobile-first), then the full
 * details list. Shop timings render only when configured — never invented.
 */
export default function ContactPage() {
  return (
    <Container className="flex flex-1 flex-col items-center py-16 sm:py-20">
      <SectionHeading
        align="center"
        eyebrow="Contact"
        title="Get in touch"
        description="Ask about availability, prices or delivery — we're happy to help."
      />

      <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        {siteContact.phone && (
          <Button size="lg" asChild className="w-full sm:w-auto">
            <a href={`tel:${siteContact.phone}`}>
              <Phone />
              Call the shop
            </a>
          </Button>
        )}
        {siteContact.whatsappUrl && (
          <Button size="lg" asChild className="w-full sm:w-auto">
            <a href={siteContact.whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
              WhatsApp
            </a>
          </Button>
        )}
        <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
          <a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer">
            <Navigation />
            Get Directions
          </a>
        </Button>
      </div>

      <ul className="mt-12 w-full max-w-md space-y-4">
        <li className="bg-card flex items-start gap-3 rounded-xl border p-4">
          <MapPin aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Visit us</p>
            <p className="text-muted-foreground mt-0.5 text-sm">{siteContact.address}</p>
          </div>
        </li>
        {siteContact.phone && (
          <li className="bg-card flex items-start gap-3 rounded-xl border p-4">
            <Phone aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Call</p>
              <a
                href={`tel:${siteContact.phone}`}
                className="text-muted-foreground hover:text-foreground mt-0.5 block text-sm"
              >
                {siteContact.phone}
              </a>
            </div>
          </li>
        )}
        {siteContact.whatsappUrl && (
          <li className="bg-card flex items-start gap-3 rounded-xl border p-4">
            <MessageCircle
              aria-hidden="true"
              className="text-muted-foreground mt-0.5 size-5 shrink-0"
            />
            <div>
              <p className="text-sm font-medium">WhatsApp</p>
              <a
                href={siteContact.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground mt-0.5 block text-sm"
              >
                Message us anytime — we reply as soon as we can
              </a>
            </div>
          </li>
        )}
        {siteContact.email && (
          <li className="bg-card flex items-start gap-3 rounded-xl border p-4">
            <Mail aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Email</p>
              <a
                href={`mailto:${siteContact.email}`}
                className="text-muted-foreground hover:text-foreground mt-0.5 block text-sm"
              >
                {siteContact.email}
              </a>
            </div>
          </li>
        )}
        <li className="bg-card flex items-start gap-3 rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Shop timings</p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {siteContact.timings ?? "To be added — please call to confirm before visiting."}
            </p>
          </div>
        </li>
      </ul>
    </Container>
  );
}
