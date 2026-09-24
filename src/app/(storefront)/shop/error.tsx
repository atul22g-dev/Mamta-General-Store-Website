"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/** Route-level error state with a retry action. */
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Shop page failed to load:", error);
  }, [error]);

  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        Something went wrong
      </p>
      <h1 className="font-display mt-3 text-2xl font-medium">We couldn&apos;t load the shop</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Please try again. If the problem continues, check back in a little while.
      </p>
      <Button className="mt-8" onClick={reset}>
        <RefreshCw />
        Try again
      </Button>
    </Container>
  );
}
