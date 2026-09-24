import { liveCategoryRefs, categoryRefs } from "@/config/categories";
import type { CategoryRef } from "@/types/category";

/**
 * Navigation definitions, consumed by header/footer components.
 * Categories are derived from the registry in `src/config/categories.ts` —
 * never hardcoded here.
 */
export interface NavItem {
  label: string;
  href: string;
}

const toNavItem = ({ name, slug }: CategoryRef): NavItem => ({
  label: name,
  href: `/category/${slug}`,
});

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

/** Footer/mobile "Categories" link column — all known categories. */
export const categoryNav: NavItem[] = categoryRefs.map(toNavItem);

/** Storefront-visible categories (header menus, category pages). */
export const liveCategoryNav: NavItem[] = liveCategoryRefs.map(toNavItem);
