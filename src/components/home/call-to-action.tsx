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
    <section className="py-16 sm:py-20" aria-labelledby="cta-heading">
      <Container>
        <div className="bg-primary text-primary-foreground relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12 sm:py-16">
          {/* Decorative glow — brand-tinted depth without imagery */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_50%_-20%,white_0%,transparent_55%)] opacity-10"
          />
          <div className="relative flex flex-col items-center">
            {categoryNames.length > 0 && (
              <p className="text-xs font-semibold tracking-widest uppercase opacity-80">
                {categoryNames.join(" · ")}
              </p>
            )}
            <h2
              id="cta-heading"
              className="font-display mt-3 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            >
              Explore What We Have
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-pretty opacity-90">
              Discover useful products for school, home, personal care and everyday life —
              delivered across India by India Post.
            </p>
            <Button
              size="lg"
              variant="secondary"
              asChild
              className="mt-8 rounded-full bg-background text-foreground shadow-soft-lg hover:bg-background/90"
            >
              <Link href="/shop">
                Explore Products
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
