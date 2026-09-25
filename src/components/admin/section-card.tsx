import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Bordered section panel with a title, optional "View all" action, and body.
 * Keeps dashboard sections visually consistent.
 */
export function SectionCard({
  title,
  actionLabel,
  actionHref,
  children,
  className,
}: {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("bg-card rounded-xl border shadow-soft", className)}
      aria-labelledby={slugify(title)}
    >
      <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
        <h2 id={slugify(title)} className="text-sm font-semibold tracking-wide uppercase">
          {title}
        </h2>
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-11 items-center gap-0.5 rounded-md px-1 text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none md:min-h-0"
          >
            {actionLabel}
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function slugify(text: string): string {
  return `section-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
