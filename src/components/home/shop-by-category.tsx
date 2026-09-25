import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getCategories } from "@/lib/supabase/catalog";
import { buttonVariants } from "@/components/ui/button-variants";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { CategoryCard } from "@/components/product/category-card";
import { cn } from "@/lib/utils";

/**
 * "Shop by Category" — live categories from the database as tiles, so a
 * category created in the admin panel appears here automatically. Falls back
 * to pointing at the categories index if the database is unreachable.
 */
export async function ShopByCategory() {
  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  try {
    categories = await getCategories();
  } catch {
    // The section hides itself below on failure; the /categories page has
    // its own error message.
  }

  return (
    <section className="py-16 sm:py-20" aria-labelledby="shop-by-category-heading">
      <Container>
        <SectionHeading
          eyebrow="Browse"
          title="Shop by Category"
          description="Start with our signature collection — more categories are on the way."
          action={
            <Link
              href="/categories"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              All categories
              <ArrowRight />
            </Link>
          }
        />
        {categories.length > 0 ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {categories.slice(0, 4).map((category) => (
              <CategoryCard
                key={category.id}
                name={category.name}
                href={`/category/${category.slug}`}
                imageUrl={category.imageUrl}
                description={category.description ?? undefined}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground mt-10 text-center text-sm">
            Categories will appear here once created in the admin panel.
          </p>
        )}
      </Container>
    </section>
  );
}
