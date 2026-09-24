import Link from "next/link";
import { ArrowRight, Mail, MapPin, Navigation, Phone } from "lucide-react";

import { DELIVERY_NOTE, GOOGLE_MAPS_URL, siteContact, siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

/** Contact rows rendered only when the detail actually exists. */
function StoreContactRow({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Phone;
  label: string;
  href?: string;
}) {
  const content = (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {label}
    </span>
  );
  return (
    <li>
      {href ? (
        <a href={href} className="transition-colors hover:text-foreground">
          {content}
        </a>
      ) : (
        content
      )}
    </li>
  );
}

/**
 * "Visit Our Local Shop" — the real shop location (Google Maps place), with
 * Get Directions. Only verified contact details are shown; nothing invented.
 */
export function VisitOurStore() {
  return (
    <section
      id="visit-our-store"
      className="border-t bg-secondary/40 py-16 sm:py-20"
      aria-labelledby="visit-store-heading"
    >
      <Container className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="Local shop"
            title="Visit Our Local Shop"
            description="Come see and feel the fabrics in person — choose your dress material with your own eyes."
            align="left"
          />
          <ul className="mt-6 space-y-3">
            <StoreContactRow
              icon={MapPin}
              label={siteContact.address ?? "Address on Google Maps"}
            />
            {siteContact.phone && (
              <StoreContactRow
                icon={Phone}
                label={siteContact.phone}
                href={`tel:${siteContact.phone}`}
              />
            )}
            {siteContact.email && (
              <StoreContactRow
                icon={Mail}
                label={siteContact.email}
                href={`mailto:${siteContact.email}`}
              />
            )}
          </ul>
          <p className="text-muted-foreground mt-4 inline-flex items-center gap-2 text-sm">
            <Navigation aria-hidden="true" className="size-4" />
            {DELIVERY_NOTE}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer">
                <MapPin />
                Get Directions
              </a>
            </Button>
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/contact">Contact details</Link>
            </Button>
          </div>
        </div>

        {/* Location card — opens the real Google Maps place. */}
        <a
          href={GOOGLE_MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Mamta General Store in Google Maps"
          className="group bg-card hover:border-ring/60 relative flex min-h-64 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border p-8 text-center shadow-soft transition-colors"
        >
          <span className="bg-accent text-accent-foreground flex size-14 items-center justify-center rounded-full transition-transform duration-300 ease-gentle group-hover:scale-105">
            <MapPin aria-hidden="true" className="size-6" />
          </span>
          <p className="font-display text-xl font-medium">{siteConfig.name}</p>
          <p className="text-muted-foreground max-w-xs text-sm">
            {siteContact.address ?? "Find us on Google Maps"}
          </p>
          <span className="text-primary mt-2 inline-flex items-center gap-1.5 text-sm font-medium">
            Open in Google Maps
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-300 ease-gentle group-hover:translate-x-0.5"
            />
          </span>
        </a>
      </Container>
    </section>
  );
}
