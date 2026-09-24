import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { categoryRegistry, liveCategories } from "@/config/categories";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ImageArea } from "@/components/ui/image-area";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Categories",
  description: "Explore product categories at Mamta General Store.",
};

/**
 * Category index, rendered from the registry: live categories first (linked),
 * upcoming categories shown as tiles marked "Coming soon".
 */
export default function CategoriesPage() {
  const liveSlugs = new Set(liveCategories.map((c) => c.slug));

  return (
    <Container className="flex flex-1 flex-col py-16 sm:py-20">
      <SectionHeading
        align="center"
        eyebrow="Browse"
        title="Categories"
        description="Explore our collections. More categories are on the way."
      />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categoryRegistry.map((category) => {
          const isLive = liveSlugs.has(category.slug);
          const tile = (
            <ImageArea
              ratio="4/5"
              className={
                isLive
                  ? "transition-shadow duration-300 ease-gentle group-hover:shadow-soft-lg"
                  : "opacity-75"
              }
            >
              {category.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={category.imageUrl}
                  alt={category.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-gentle group-hover:scale-[1.03]"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-card/95 px-4 py-3 backdrop-blur-sm">
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-medium">{category.name}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {category.description}
                  </p>
                </div>
                {isLive ? (
                  <ArrowRight className="size-4 shrink-0 transition-transform duration-300 ease-gentle group-hover:translate-x-1" />
                ) : (
                  <Badge variant="outline" className="shrink-0">
                    Coming soon
                  </Badge>
                )}
              </div>
            </ImageArea>
          );

          return isLive ? (
            <Link key={category.id} href={`/category/${category.slug}`} className="group block">
              {tile}
            </Link>
          ) : (
            <div key={category.id} aria-disabled="true" className="group block cursor-default">
              {tile}
            </div>
          );
        })}
      </div>
    </Container>
  );
}
