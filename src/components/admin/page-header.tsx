import { cn } from "@/lib/utils";

/** Standard admin page heading with optional description and right-side actions. */
export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  /** Right-aligned actions (e.g. an "Add product" button). */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
      {description && <p className="text-muted-foreground mt-1.5 text-sm">{description}</p>}
    </div>
  );
}
