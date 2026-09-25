import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Quiet placeholder shown when a section has no data yet. */
export function EmptyState({
  icon: Icon,
  message,
  hint,
  className,
}: {
  icon: LucideIcon;
  message: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 py-10 text-center", className)}>
      <span className="bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-full">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="text-sm font-medium">{message}</p>
      {hint && <p className="text-muted-foreground max-w-xs text-xs">{hint}</p>}
    </div>
  );
}

/**
 * Shown when the database is unreachable. States the problem plainly and
 * points at the fix — never a raw error message.
 */
export function DatabaseErrorState({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 py-10 text-center", className)}>
      <span className="bg-destructive/10 text-destructive flex size-10 items-center justify-center rounded-full">
        <IconDatabase aria-hidden="true" className="size-5" />
      </span>
      <p className="text-sm font-medium">Database not connected</p>
      <p className="text-muted-foreground max-w-sm text-xs">
        Configure <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> or{" "}
        <code className="font-mono">EXPO_PUBLIC_SUPABASE_URL</code> and the matching anon key in{" "}
        <code className="font-mono">.env</code> — see .env.example.
      </p>
    </div>
  );
}

function IconDatabase({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14A9 3 0 0 0 21 19V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </svg>
  );
}
