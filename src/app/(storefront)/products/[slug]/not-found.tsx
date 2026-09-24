import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

/** Shown when a product slug doesn't exist (or is inactive). */
export default function ProductNotFound() {
  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">404</p>
      <h1 className="font-display mt-3 text-3xl font-medium tracking-tight">Product not found</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        This product may have been removed or is no longer available. Explore the shop for the
        latest collection.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/shop" className={cn(buttonVariants())}>
          Continue shopping
        </Link>
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
          Back to home
        </Link>
      </div>
    </Container>
  );
}
