import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { getCategories } from "@/lib/supabase/catalog";
import type { Category } from "@/types/category";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ImageArea } from "@/components/ui/image-area";

export const metadata: Metadata = {
  title: "Categories",
  description: "Explore product categories at Mamta General Store.",
  alternates: { canonical: "/categories" },
  openGraph: {
    title: "Categories — Mamta General Store",
    description: "Explore product categories at Mamta General Store.",
    type: "website",
    url: "/categories",
  },
};

/** Refresh from the database without a rebuild (same cadence as the home page). */
export const revalidate = 60;

/** Category index, rendered straight from the database. */
export default async function CategoriesPage() {
  let categories: Category[] = [];
  let dbFailed = false;
  try {
    categories = await getCategories();
  } catch {
    dbFailed = true;
  }

  return (
    <Container className="flex flex-1 flex-col py-16 sm:py-20">
      <SectionHeading
        align="center"
        eyebrow="Browse"
        title="Categories"
        description="Explore our collections. More categories are on the way."
      />

      {dbFailed ? (
        <p className="text-muted-foreground mt-16 text-center text-sm">
          The catalog is momentarily unavailable — please refresh in a moment.
        </p>
      ) : categories.length === 0 ? (
        <p className="text-muted-foreground mt-16 text-center text-sm">
          No categories yet — they appear here as soon as they are created in the admin panel.
        </p>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link key={category.id} href={`/category/${category.slug}`} className="group block">
              <ImageArea
                ratio="4/5"
                className="transition-shadow duration-300 ease-gentle group-hover:shadow-soft-lg"
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
                    {category.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="size-4 shrink-0 transition-transform duration-300 ease-gentle group-hover:translate-x-1" />
                </div>
              </ImageArea>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
