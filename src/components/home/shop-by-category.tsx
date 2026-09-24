import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { liveCategories } from "@/config/categories";
import { buttonVariants } from "@/components/ui/button-variants";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { CategoryCard } from "@/components/product/category-card";
import { cn } from "@/lib/utils";

/** "Shop by Category" — live categories as tiles; grows as new ones launch. */
export function ShopByCategory() {
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
        <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {liveCategories.map((category) => (
            <CategoryCard
              key={category.id}
              name={category.name}
              href={`/category/${category.slug}`}
              imageUrl={category.imageUrl}
              description={category.description}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
