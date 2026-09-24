import { dbHealth } from "@/lib/supabase/health";
import { cn } from "@/lib/utils";

/**
 * Live database connectivity pill for the admin header. Server-rendered —
 * the probe runs on the server on each admin navigation, so the indicator
 * always reflects the real connection without any client-side polling.
 *
 * "Not ready" covers every unhealthy case honestly: env vars missing,
 * project unreachable, or migrations not fully applied.
 */
export async function DatabaseStatus({ className }: { className?: string }) {
  const connected = await dbHealth();

  const label = connected ? "Database connected" : "Database not ready";

  return (
    <span
      role="status"
      title={
        connected
          ? "Database connection is healthy"
          : "Database is unreachable or not configured — check .env and Supabase migrations"
      }
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium",
        connected
          ? "border-emerald-600/20 bg-emerald-500/10 text-emerald-700"
          : "border-destructive/20 bg-destructive/10 text-destructive",
        className,
      )}
    >
      {/* Pulsing dot when healthy, steady red when not */}
      <span className="relative flex size-2" aria-hidden="true">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            connected ? "bg-emerald-500" : "bg-destructive",
          )}
        />
      </span>
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
