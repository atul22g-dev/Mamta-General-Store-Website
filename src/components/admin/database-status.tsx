"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { recheckDatabaseAction, type DbStatusSnapshot } from "@/app/admin/db-status-actions";
import { cn } from "@/lib/utils";

interface DbStatusProps {
  /**
   * Supabase project host (public URL origin), e.g. "abc123.supabase.co".
   * Display-only — the probe itself runs client-side on demand.
   */
  host: string;
  className?: boolean;
}

/** Module-level: building an Intl formatter is slow — never do it per call. */
// UTC with an explicit suffix: deterministic on server and client, so the
// label can be derived during render (no effect, no hydration mismatch).
const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function formatTime(iso: string): string {
  try {
    return `${timeFormatter.format(new Date(iso))} UTC`;
  } catch {
    return iso;
  }
}

/**
 * Admin database connectivity indicator with an on-click detail dialog.
 *
 * PERFORMANCE: the probe no longer runs server-side on every admin render
 * (that was a blocking Supabase round-trip in the layout before any page
 * could paint). The dot renders optimistically as connected and the first
 * real probe runs lazily in the background after mount; the popover shows
 * the freshest result with a "Check again" re-probe.
 */
export function DatabaseStatus({ host, className }: DbStatusProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DbStatusSnapshot | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const probedRef = useRef(false);

  const connected = status ? status.connected : true;

  // Lazily run the first probe once after mount — off the critical render
  // path. Repeated renders never re-trigger it.
  useEffect(() => {
    if (probedRef.current) return;
    probedRef.current = true;
    startTransition(async () => {
      setStatus(await recheckDatabaseAction());
    });
  }, []);

  // Native <dialog> in the non-modal show() mode: open/close stays owned by
  // React state, while the element itself supplies the dialog semantics
  // (role, labeling, Escape-to-close) for free. Non-modal show() does not
  // move focus (unlike showModal()), so focus is moved explicitly — without
  // it, Escape would never reach the dialog and only the trigger's toggle
  // would close it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.show();
      dialog.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Close on outside pointer-down and Escape. (Non-modal show() dialogs do
  // NOT get native Escape-to-close in Chromium — that's a showModal() behavior
  // — so the keydown is handled here; the element still contributes the
  // native dialog semantics/labeling, and onClose syncs programmatic closes.)
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

  return (
    <span ref={rootRef} className={cn("relative inline-flex items-center", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
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
        {/* Pulsing dot when healthy (assumed until the first probe lands),
            steady red when not */}
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
      )}{" "}
      {/* Non-modal popover, ALWAYS mounted: show()/close() stay fully owned by
          the effect below, so React state and the native dialog state can
          never race (a conditionally-mounted dialog re-enters the DOM without
          its previous open state, and remount/effect ordering gets murky).
          A closed dialog is display:none by default — no layout cost.

          Anchored as an absolute dropdown below the status dot (NOT a fixed
          viewport-centered dialog): the sticky header carries backdrop-blur,
          and an element with backdrop-filter is the containing block for
          fixed-position descendants — a fixed dialog in here would be
          positioned relative to the 64px header and end up clipped off the
          top of the screen. Absolute inside this span.relative sidesteps the
          containing block entirely and keeps the popover attached to its dot. */}
      <dialog
        ref={dialogRef}
        id={dialogId}
        tabIndex={-1}
        aria-label="Database connection details"
        onClose={() => setOpen(false)}
        className="bg-card shadow-soft-lg absolute top-[calc(100%+8px)] right-0 z-50 w-72 max-w-[min(18rem,calc(100vw-1rem))] rounded-xl border p-4 text-sm backdrop:bg-transparent open:animate-in open:fade-in-0 open:zoom-in-95"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">Database status</span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
              connected ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive",
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
              {status?.latencyMs == null ? "—" : `${status.latencyMs} ms`}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt>Last checked</dt>
            <dd className="text-foreground tabular-nums">
              {status ? formatTime(status.checkedAt) : "—"}
            </dd>
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
      </dialog>
    </span>
  );
}
