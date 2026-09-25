import type { Metadata } from "next";

import { SITE_DESCRIPTION, SITE_NAME, SITE_POSITIONING_WITH_DUPATTA } from "@/lib/constants";
import { Hero } from "@/components/home/hero";
import { FeaturedProducts } from "@/components/home/featured-products";
import { NewArrivals } from "@/components/home/new-arrivals";
import { ProductCollection } from "@/components/home/product-collection";
import { VisitOurStore } from "@/components/home/visit-our-store";
import { ContactBand } from "@/components/home/contact-band";
import { CallToAction } from "@/components/home/call-to-action";

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} — ${SITE_POSITIONING_WITH_DUPATTA} in Jatwar, Haryana`,
  },
  description: `${SITE_DESCRIPTION.replace(
    "Visit our local shop or order by India Post.",
    "Visit our shop near the Post Office or order by India Post.",
  )}`,
};

/**
 * Homepage. Each band is its own component under `components/home/`;
 * catalog sections stream from the database (ISR: 60s refresh).
 */
export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      <Hero />
      <NewArrivals />
      <FeaturedProducts />
      <ProductCollection />
      <VisitOurStore />
      <ContactBand />
      <CallToAction />
    </>
  );
}
