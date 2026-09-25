import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getCategories } from "@/lib/supabase/catalog";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * Closing call to action: one clear next step on an ink background. The
 * category names line comes live from the database (best-effort).
 */
export async function CallToAction() {
  let categoryNames: string[] = [];
  try {
    categoryNames = (await getCategories()).map((category) => category.name);
  } catch {
    // Cosmetic line only — the section still renders without it.
  }

  return (
    <section
      className="bg-primary py-16 text-primary-foreground sm:py-20"
      aria-labelledby="cta-heading"
    >
      <Container className="flex flex-col items-center text-center">
        {categoryNames.length > 0 && (
          <p className="text-xs font-medium tracking-widest uppercase opacity-70">
            {categoryNames.join(" · ")}
          </p>
        )}
        <h2
          id="cta-heading"
          className="font-display mt-3 max-w-xl text-3xl font-medium tracking-tight text-balance sm:text-4xl"
        >
          Find the suit material that feels made for you
        </h2>
        <p className="mt-4 max-w-md text-pretty leading-relaxed opacity-80">
          Explore the collection — delivered across India by India Post.
        </p>
        <Button
          size="lg"
          variant="secondary"
          asChild
          className="mt-8 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
        >
          <Link href="/shop">
            Shop Now
            <ArrowRight />
          </Link>
        </Button>
      </Container>
    </section>
  );
}
