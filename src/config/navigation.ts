/**
 * Navigation definitions, consumed by header/footer components.
 * Static links only — categories are managed on the /categories page and in
 * the admin panel, not shown as header links.
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
