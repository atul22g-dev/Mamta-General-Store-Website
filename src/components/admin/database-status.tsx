"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { recheckDatabaseAction, type DbStatusSnapshot } from "@/app/admin/db-status-actions";
import { cn } from "@/lib/utils";

interface DbStatusProps {
  /** Server-probed state at page render — the popover's starting data. */
  initial: DbStatusSnapshot;
  /** Supabase project host (public URL origin), e.g. "abc123.supabase.co". */
  host: string;
  className?: string;
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Admin database connectivity indicator with an on-click detail popover.
 *
 * Quiet by default: a pulsing green dot when healthy, loud red dot + "DB
 * offline" label when not. Clicking (or keyboard-activating) the dot opens
 * a popover with the real connection details — measured round-trip latency,
 * project host, when the probe last ran — and a "Check again" button that
 * re-runs the same server-side probe live.
 */
export function DatabaseStatus({ initial, host, className }: DbStatusProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DbStatusSnapshot>(initial);
  const [pending, startTransition] = useTransition();
  const popoverId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  // Dismiss like a native popover: Escape closes and returns focus to the
  // trigger; clicking/tapping anywhere outside also closes.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector("button")?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const recheck = () => {
    startTransition(async () => {
      setStatus(await recheckDatabaseAction());
    });
  };

  const connected = status.connected;

  return (
    <span ref={rootRef} className={cn("relative inline-flex items-center", className)}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label={`Database ${connected ? "connected" : "not ready"} — show connection details`}
        title={
          connected ? "Database connection is healthy" : "Database is unreachable or not configured"
        }
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "focus-visible:ring-ring/50 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors focus-visible:ring-[3px] focus-visible:outline-none md:min-h-9 md:min-w-9",
          connected ? "hover:bg-accent" : "hover:bg-destructive/10",
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
      </button>
      {!connected && (
        <span className="text-destructive text-xs font-semibold whitespace-nowrap">DB offline</span>
      )}

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Database connection details"
          className="bg-card shadow-soft-lg absolute top-full left-1/2 z-50 mt-2 w-72 -translate-x-1/2 rounded-xl border p-4 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Database status</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                connected
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-1.5 rounded-full",
                  connected ? "bg-emerald-500" : "bg-destructive",
                )}
                aria-hidden="true"
              />
              {connected ? "Connected" : "Offline"}
            </span>
          </div>

          <dl className="text-muted-foreground mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt>Project</dt>
              <dd className="text-foreground truncate font-mono">{host}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt>Response time</dt>
              <dd className="text-foreground tabular-nums">
                {status.latencyMs === null ? "—" : `${status.latencyMs} ms`}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt>Last checked</dt>
              <dd className="text-foreground tabular-nums">{formatTime(status.checkedAt)}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={recheck}
            disabled={pending}
            className="bg-primary text-primary-foreground focus-visible:ring-ring/50 mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-60"
          >
            {pending ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : null}
            {pending ? "Checking…" : "Check again"}
          </button>
        </div>
      )}
    </span>
  );
}
