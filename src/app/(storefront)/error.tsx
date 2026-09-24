"use client";

import { useEffect } from "react";

import { buttonVariants } from "@/components/ui/button-variants";
import { Container } from "@/components/ui/container";

/**
 * Storefront error boundary. Catches unexpected render failures (e.g. the
 * database being briefly unreachable) with a friendly, actionable message
 * instead of a raw error digest.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[storefront]", error);
  }, [error]);

  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        Something went wrong
      </p>
      <h1 className="font-display mt-3 text-3xl font-medium tracking-tight">
        We couldn&apos;t load this page
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-sm leading-relaxed">
        This is usually temporary. Please try again in a moment — if it keeps happening, contact us
        and we&apos;ll help you out.
      </p>
      <button type="button" onClick={reset} className={`${buttonVariants()} mt-8`}>
        Try again
      </button>
    </Container>
  );
}
