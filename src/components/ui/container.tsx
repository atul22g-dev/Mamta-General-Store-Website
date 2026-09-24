import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Centered page container with generous, responsive horizontal padding.
 * Every page/section nests inside this so spacing stays consistent.
 */
function Container({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="container"
      className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
}

export { Container };
