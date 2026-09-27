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
/**
 * Hard boundary around next/image. If the Image component throws during
 * render (e.g. a hostname missing from images.remotePatterns because the
 * deployment's env vars were set after its build), degrade to the quiet
 * "image unavailable" box instead of crashing the whole page.
 */
class ImageErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { errored: boolean }
> {
  state = { errored: false };

  static getDerivedStateFromError() {
    return { errored: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[SafeImage] render error:", error);
  }

  render() {
    return this.state.errored ? this.props.fallback : this.props.children;
  }
}

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

  const unavailableBox = (
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

  if (failed) {
    return unavailableBox;
  }

  const eagerProps = eager
    ? ({ priority: true, loading: undefined } as const)
    : { priority: false, loading: loading as "lazy" | "eager" };

  return (
    <ImageErrorBoundary fallback={unavailableBox}>
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
    </ImageErrorBoundary>
  );
}
