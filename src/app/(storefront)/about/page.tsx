import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { DELIVERY_NOTE, GOOGLE_MAPS_URL } from "@/config/site";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About Us",
  description: `${SITE_NAME} is a local shop near the Post Office in Jatwar, Haryana, offering women's unstitched dress materials — daily wear, festive and premium collections, delivered across India by India Post.`,
};

/** About the local shop — only verifiable facts, no invented claims. */
export default function AboutPage() {
  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-20 text-center sm:py-28">
      <SectionHeading
        align="center"
        eyebrow="About Us"
        title={SITE_NAME}
        description="A local shop near the Post Office in Jatwar, Haryana — specialising in women's unstitched dress materials."
      />
      <div className="text-muted-foreground mt-6 max-w-lg space-y-4 text-sm leading-relaxed">
        <p>
          Every piece is a complete unstitched set — top, bottom and dupatta — so you can have it
          tailored exactly the way you like it. From breathable cottons for daily wear to printed,
          embroidered and premium fabrics for festive occasions, every material is checked by hand
          before it reaches the shelf.
        </p>
        <p>
          Visit the shop to see and feel the fabrics yourself, or browse the collection here and{" "}
          {DELIVERY_NOTE.toLowerCase()}.
        </p>
        <p>
          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:underline"
          >
            Find us on Google Maps →
          </a>
        </p>
      </div>
    </Container>
  );
}
