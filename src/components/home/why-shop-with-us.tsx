import { PackageCheck, Ruler, ShieldCheck, Sparkles } from "lucide-react";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const perks = [
  {
    icon: Sparkles,
    title: "Hand-checked fabrics",
    description: "Every dress material is inspected for fabric, work and finish.",
  },
  {
    icon: PackageCheck,
    title: "Delivered by India Post",
    description: "Orders are packed carefully and sent by Post across India.",
  },
  {
    icon: Ruler,
    title: "Complete sets",
    description: "Clear top, bottom and dupatta details on every product.",
  },
  {
    icon: ShieldCheck,
    title: "Local shop you can visit",
    description: "See and feel the fabrics in person at our Jatwar shop.",
  },
] as const;

/** "Why Shop With Us" — quiet trust badges, no exaggerated claims. */
export function WhyShopWithUs() {
  return (
    <section className="border-t bg-secondary/40 py-16 sm:py-20" aria-labelledby="why-shop-heading">
      <Container>
        <SectionHeading
          align="center"
          eyebrow="Our promise"
          title="Why Shop With Us"
          description="A small shop that cares about the details."
        />
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col items-center text-center">
              <span className="flex size-12 items-center justify-center rounded-full border bg-card shadow-xs">
                <Icon className="size-5 text-muted-foreground" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 max-w-[26ch] text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
