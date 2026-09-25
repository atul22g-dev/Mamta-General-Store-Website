import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared text input.
 *
 * Padding is declared with longhands (`pl-*`/`pr-*`, never `px-*`) on
 * purpose: Tailwind v4 emits the `px` shorthand after the longhands in the
 * stylesheet, so a caller's `pl-9` override would silently lose to a base
 * `px-3.5` — leaving leading search icons underneath the placeholder text.
 * With longhands, tailwind-merge strips the matching side and the caller's
 * override wins at every breakpoint.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-11 w-full min-w-0 rounded-md border bg-transparent py-1 pr-3.5 pl-3.5 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
