"use client";

import * as React from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Product image with a built-in broken-image fallback.
 *
 * Product photos live in Supabase Storage; a row can point at a deleted or
 * renamed object (or a transient storage outage). A plain <img> then renders
 * a silent empty box. This component swaps in a clear "image unavailable"
 * state the moment the browser fails to load the file — on cards, in the
 * gallery and in admin tables alike.
 */
export function SafeImage({
  src,
  alt,
  className,
  loading = "lazy",
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  /** Highest-priority above-the-fold rendering (LCP image). */
  eager?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} — image unavailable`}
        className={cn(
          "bg-muted text-muted-foreground/60 flex h-full w-full flex-col items-center justify-center gap-1",
          className,
        )}
      >
        <ImageOff aria-hidden="true" strokeWidth={1.5} className="size-6" />
        <span className="text-[10px] tracking-wide uppercase">Image unavailable</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- product photos come from the project's own Supabase Storage host
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : loading}
      // A cached failure should not permanently hide the photo: retry on
      // re-mount. Keyed by src at the call site for URL changes.
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
