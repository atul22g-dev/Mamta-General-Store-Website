import type { CategoryRef } from "@/types/category";

/**
 * Navigation definitions, consumed by header/footer components.
 * Category links come from the database: `(storefront)/layout.tsx` reads live
 * categories via `lib/supabase/catalog.ts` and passes them as props — nothing
 * static here.
 */

export interface NavItem {
  label: string;
  href: string;
}

/** Primary storefront navigation: desktop header + mobile menu. */
export const mainNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Categories", href: "/categories" },
  { label: "About Us", href: "/about" },
  { label: "Delivery", href: "/delivery" },
  { label: "Contact", href: "/contact" },
];

/** Footer "Shop" link column. */
export const shopNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Categories", href: "/categories" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Cart", href: "/cart" },
];

/** Map lightweight category refs onto nav items. */
export const toNavItems = (categories: CategoryRef[]): NavItem[] =>
  categories.map(({ name, slug }) => ({ label: name, href: `/category/${slug}` }));
