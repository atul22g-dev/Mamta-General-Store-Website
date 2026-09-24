import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Soft shimmer placeholder used while products/images load.
 * Render inside the same box the real content will occupy.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
