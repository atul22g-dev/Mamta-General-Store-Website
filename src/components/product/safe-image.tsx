"use client";

import * as React from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Product image with a built-in broken-image fallback — now on next/image.
 *
 * Product photos live in Supabase Storage (the project host is allow-listed
 * in next.config.ts `images.remotePatterns`); a row can still point at a
 * deleted or renamed object, or storage can hiccup. A broken <img> renders a
 * silent empty box; this component swaps in a clear "image unavailable"
 * state the moment the file fails to load — on cards, in the gallery and in
 * admin tables alike.
 *
 * next/image optimizes (resize, WebP/AVIF re-encode) and lazy-loads by
 * default. `priority` maps to the LCP image; `fill` matches the common
 * absolutely-positioned catalog frame (parent must be relative/aspect).
 */
export function SafeImage({
  src,
  alt,
  className,
  loading = "lazy",
  eager = false,
  fill = false,
  sizes,
  width = 800,
  height = 1067,
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  /** Highest-priority above-the-fold rendering (LCP image). */
  eager?: boolean;
  /**
   * Stretch to the parent box (parent needs position/aspect). `false` keeps
   * intrinsic sizing for stand-alone images like the zoom lightbox.
   */
  fill?: boolean;
  /** Responsive sizes hint for the optimizer (fill mode). */
  sizes?: string;
  /** Intrinsic dimensions for non-fill mode (aspect ratio + optimizer hint). */
  width?: number;
  height?: number;
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

  const eagerProps = eager
    ? ({ priority: true, loading: undefined } as const)
    : { priority: false, loading: loading as "lazy" | "eager" };

  return (
    <Image
      src={src}
      alt={alt}
      // A cached failure should not permanently hide the photo: retry on
      // re-mount. Keyed by src at the call site for URL changes.
      onError={() => setFailed(true)}
      className={className}
      {...(fill ? { fill: true, sizes } : { width, height })}
      {...eagerProps}
    />
  );
}
