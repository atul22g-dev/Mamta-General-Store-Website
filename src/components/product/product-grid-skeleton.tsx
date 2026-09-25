import { cn } from "@/lib/utils";

/** Placeholder grid shown while catalog sections stream from the database. */
export function ProductGridSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4", className)}
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-3">
          <div className="bg-muted aspect-[3/4] w-full rounded-xl" />
          <div className="bg-muted h-4 w-3/4 rounded" />
          <div className="bg-muted h-4 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}
