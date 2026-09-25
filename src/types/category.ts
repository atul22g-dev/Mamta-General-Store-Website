/**
 * Category domain type — mirrors `prisma/schema.prisma` → `Category`.
 *
 * Deliberately decoupled from generated Prisma types so UI code stays stable
 * regardless of how the data layer evolves. Data mappers (added when the DB is
 * connected) map rows onto these types.
 *
 * The live category list for navigation/SEO is read from the database via
 * `lib/supabase/catalog.ts`.
 */
export interface Category {
  id: string;
  /** Display name, e.g. "Ladies' Suits". */
  name: string;
  /** URL slug used in /category/[slug] routes, e.g. "ladies-suits". */
  slug: string;
  description: string | null;
  /** Tile image for category listings (null = ImageArea placeholder). */
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight category reference embedded in products/lists. */
export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}
