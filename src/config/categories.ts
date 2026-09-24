import type { CategoryRef } from "@/types/category";

/**
 * Category registry — the single source of truth for product categories.
 *
 * The database is not connected yet, so navigation, SEO and placeholder data
 * derive from this list instead of hardcoded strings scattered through the app.
 * When the DB is connected, these functions read `Category` rows instead while
 * every consumer keeps calling the same helpers.
 *
 * To launch a new category later: add an entry here (plus products in the DB).
 */
export interface CategoryDefinition extends CategoryRef {
  description: string;
  imageUrl: string | null;
}

const definition = (
  slug: string,
  name: string,
  description: string,
  imageUrl: string | null = null,
): CategoryDefinition => ({
  id: slug,
  slug,
  name,
  description,
  imageUrl,
});

/**
 * All known categories, in intended display order, with placeholder tile
 * imagery. Live categories launch as inventory arrives. The primary product
 * of the shop is Women's Unstitched Dress Material; the first entries below
 * reflect its natural sub-collections (cotton, printed, embroidered…).
 */
export const categoryRegistry: CategoryDefinition[] = [
  definition(
    "dress-material",
    "Dress Material",
    "Complete unstitched top–bottom–dupatta sets, ready for tailoring.",
    "https://images.unsplash.com/photo-1596944924616-7b38e7cfac36?q=80&w=900&auto=format&fit=crop",
  ),
  definition(
    "cotton-dress-material",
    "Cotton Dress Material",
    "Breathable cottons for comfortable everyday wear.",
    "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=900&auto=format&fit=crop",
  ),
  definition(
    "printed-dress-material",
    "Printed Dress Material",
    "Fresh prints for casual and office wear.",
    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=900&auto=format&fit=crop",
  ),
  definition(
    "embroidered-dress-material",
    "Embroidered Dress Material",
    "Work-rich sets for festive and occasion dressing.",
    "https://images.unsplash.com/photo-1583391733956-6c78276477e2?q=80&w=900&auto=format&fit=crop",
  ),
];

/** Categories visible on the storefront now. */
const LIVE_SLUGS = new Set(["dress-material", "cotton-dress-material", "printed-dress-material"]);

export const liveCategories: CategoryDefinition[] = categoryRegistry.filter((c) =>
  LIVE_SLUGS.has(c.slug),
);

/** All categories as lightweight refs (for navigation, sitemaps, embeds). */
export const categoryRefs: CategoryRef[] = categoryRegistry.map(({ id, name, slug }) => ({
  id,
  name,
  slug,
}));

export const liveCategoryRefs: CategoryRef[] = liveCategories.map(({ id, name, slug }) => ({
  id,
  name,
  slug,
}));

/** Find a category definition by slug (any known category). */
export function findCategoryBySlug(slug: string): CategoryDefinition | undefined {
  return categoryRegistry.find((c) => c.slug === slug);
}

/** Find a category definition by its id (convenience for seeded data). */
export function findCategoryById(id: string): CategoryDefinition | undefined {
  return categoryRegistry.find((c) => c.id === id);
}
