import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";

import { mainNav } from "@/config/navigation";
import { GOOGLE_MAPS_URL, SHOP_ADDRESS, siteContact, siteConfig } from "@/config/site";
import { SITE_POSITIONING_SHORT, SITE_NAME } from "@/lib/constants";
import { Container } from "@/components/ui/container";
import { Separator } from "@/components/ui/separator";

/**
 * Site footer — professional and compact: brand + product line, the real
 * postal address, all primary links (incl. Delivery and the Google Maps
 * place) and the copyright.
 */
export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <Container className="py-10 sm:py-12">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="max-w-md space-y-2">
            <p className="font-display text-lg font-medium tracking-tight">{SITE_NAME}</p>
            <p className="text-sm text-muted-foreground">{SITE_POSITIONING_SHORT}</p>
            <p className="text-muted-foreground inline-flex items-start justify-center gap-1.5 text-sm">
              <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <span className="text-balance">{SHOP_ADDRESS}</span>
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="focus-visible:ring-ring/50 -mx-1 inline-flex min-h-11 items-center px-1 py-2 text-sm text-muted-foreground transition-colors duration-200 ease-gentle hover:text-foreground focus-visible:ring-[3px] focus-visible:outline-none sm:min-h-0 sm:py-0"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-visible:ring-ring/50 -mx-1 inline-flex min-h-11 items-center gap-1 px-1 py-2 text-sm text-muted-foreground transition-colors duration-200 ease-gentle hover:text-foreground focus-visible:ring-[3px] focus-visible:outline-none sm:min-h-0 sm:py-0"
                >
                  Google Maps
                  <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              </li>
            </ul>
          </nav>

          <p className="text-muted-foreground text-sm">
            Questions? Call{" "}
            {siteContact.phone && (
              <a
                href={`tel:${siteContact.phone}`}
                className="focus-visible:ring-ring/50 inline-flex min-h-11 items-center text-foreground focus-visible:ring-[3px] focus-visible:outline-none hover:underline sm:min-h-0"
              >
                {siteContact.phone}
              </a>
            )}
          </p>
        </div>

        <Separator className="my-8" />

        <p className="text-muted-foreground text-center text-xs">
          © {new Date().getFullYear()} {SITE_NAME}, {siteConfig.tagline}. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
