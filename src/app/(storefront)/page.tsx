import type { Metadata } from "next";

import { SITE_NAME } from "@/lib/constants";
import { Hero } from "@/components/home/hero";
import { FeaturedProducts } from "@/components/home/featured-products";
import { NewArrivals } from "@/components/home/new-arrivals";
import { ProductCollection } from "@/components/home/product-collection";
import { VisitOurStore } from "@/components/home/visit-our-store";
import { ContactBand } from "@/components/home/contact-band";
import { CallToAction } from "@/components/home/call-to-action";

export const metadata: Metadata = {
  title: {
    absolute: `${SITE_NAME} | General Store in Jatwar, Haryana`,
  },
  description:
    "Mamta General Store in Jatwar, Haryana offers a variety of everyday products including school essentials, stationery, bags, footwear, personal-care items, toys, accessories, household products and more.",
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
