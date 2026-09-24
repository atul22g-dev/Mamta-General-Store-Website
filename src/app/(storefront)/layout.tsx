import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CartProvider } from "@/components/cart/cart-provider";

/**
 * Storefront chrome: site header + footer wrap every customer-facing page,
 * with the shared client cart store available throughout.
 * Lives in a route group so /admin keeps its own separate layout.
 */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <SiteHeader />
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
    </CartProvider>
  );
}
