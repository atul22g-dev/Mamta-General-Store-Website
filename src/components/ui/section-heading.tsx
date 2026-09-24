import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Consistent section heading: small uppercase eyebrow, serif display title,
 * optional description and trailing action (e.g. "View all →").
 */
interface SectionHeadingProps extends React.ComponentProps<"div"> {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  align?: "left" | "center";
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div
      data-slot="section-heading"
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "sm:flex-col sm:items-center sm:text-center",
        className,
      )}
      {...props}
    >
      <div className={cn("max-w-2xl space-y-2", align === "center" && "text-center")}>
        {eyebrow && (
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-2xl font-medium tracking-tight text-balance sm:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export { SectionHeading };
