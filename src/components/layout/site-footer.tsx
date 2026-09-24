import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";

import { mainNav } from "@/config/navigation";
import { GOOGLE_MAPS_URL, SHOP_ADDRESS, siteContact, siteConfig } from "@/config/site";
import { SITE_NAME } from "@/lib/constants";
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
            <p className="text-sm text-muted-foreground">Women&apos;s Unstitched Dress Materials</p>
            <p className="text-muted-foreground inline-flex items-start justify-center gap-1.5 text-sm">
              <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {SHOP_ADDRESS}
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors duration-200 ease-gentle"
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
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors duration-200 ease-gentle"
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
              <a href={`tel:${siteContact.phone}`} className="text-foreground hover:underline">
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
