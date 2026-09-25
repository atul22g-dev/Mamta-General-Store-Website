import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { SITE_NAME } from "@/lib/constants";

/**
 * Root 404 — matches URLs that don't hit any route (renders outside the
 * storefront layout, so it stays self-contained). In-storefront misses
 * (e.g. /category/unknown) use (storefront)/not-found.tsx with full chrome.
 */
export default function RootNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">404</p>
      <h1 className="font-display mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
        Page not found
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-sm leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist or has moved. It may have been an old
        link from before the {SITE_NAME} website update.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/" className={buttonVariants()}>
          Back to home
        </Link>
        <Link href="/shop" className={buttonVariants({ variant: "outline" })}>
          Browse the shop
        </Link>
      </div>
    </div>
  );
}
