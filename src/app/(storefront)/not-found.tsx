import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { Container } from "@/components/ui/container";

/**
 * Storefront 404 — catches notFound() thrown inside storefront pages (unknown
 * category slugs, removed pages) while keeping the site header and footer.
 */
export default function StorefrontNotFound() {
  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">404</p>
      <h1 className="font-display mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
        We couldn&apos;t find that page
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-sm leading-relaxed">
        The link may be outdated or the item is no longer available. Everything we stock is in the
        shop — browsing usually finds it faster than searching.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/shop" className={buttonVariants()}>
          Browse all products
        </Link>
        <Link href="/categories" className={buttonVariants({ variant: "outline" })}>
          View categories
        </Link>
      </div>
    </Container>
  );
}
