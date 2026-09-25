import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CartProvider } from "@/components/cart/cart-provider";
import { getCategories } from "@/lib/supabase/catalog";
import type { CategoryRef } from "@/types/category";

/**
 * Storefront chrome: site header + footer wrap every customer-facing page,
 * with the shared client cart store available throughout.
 * Lives in a route group so /admin keeps its own separate layout.
 *
 * Categories come from the database (never a static registry) and are passed
 * down to the header/mobile menu. On a database failure the storefront still
 * renders — just without category links.
 */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  let categories: CategoryRef[] = [];
  try {
    categories = (await getCategories()).map(({ id, name, slug }) => ({
      id,
      name,
      slug,
    }));
  } catch (error) {
    console.error("[layout] Failed to load categories for navigation:", error);
  }

  return (
    <CartProvider>
      <SiteHeader categories={categories} />
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
    </CartProvider>
  );
}
