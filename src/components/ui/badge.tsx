import * as React from "react";

import { cn } from "@/lib/utils";

const badgeStyles =
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide transition-[color,box-shadow] [&>svg]:pointer-events-none [&>svg]:size-3";

const badgeVariants: Record<string, string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  accent: "border-transparent bg-accent text-accent-foreground",
  outline: "text-muted-foreground",
  destructive: "border-transparent bg-destructive text-destructive-foreground",
};

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & { variant?: keyof typeof badgeVariants }) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeStyles, badgeVariants[variant], className)}
      {...props}
    />
  );
}

export { Badge };
