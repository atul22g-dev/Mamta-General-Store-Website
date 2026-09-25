import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Dashboard statistic tile: icon, label, big number, optional delta/link.
 * Purely presentational and reused across the dashboard.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  hint,
  className,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  /** Where the stat links to (e.g. /admin/products). */
  href?: string;
  /** Small supplementary line under the value. */
  hint?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm leading-snug font-medium">{label}</span>
        <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon aria-hidden="true" className="size-4.5" />
        </span>
      </div>
      <p className="font-display mt-3 text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </>
  );

  const styles = cn(
    // h-full: grid items stretch by default, but a block child collapses to
    // content height — h-full keeps sibling cards equal-height on mobile
    // where "Total products" wraps to two lines and others don't.
    "bg-card block h-full rounded-xl border p-5 shadow-soft transition-shadow hover:shadow-soft-lg",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={styles}>
        {body}
      </Link>
    );
  }

  return <div className={styles}>{body}</div>;
}
