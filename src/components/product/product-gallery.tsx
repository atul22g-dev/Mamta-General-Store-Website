"use client";

import * as React from "react";

import type { ProductImage } from "@/types/product";
import { cn } from "@/lib/utils";
import { ImageArea } from "@/components/ui/image-area";

/**
 * Product image gallery:
 * - Mobile: swipeable strip (scroll-snap) with dots.
 * - Desktop: large image + thumbnail buttons.
 * - Click/tap the large image to zoom (lightbox, Esc/close to dismiss).
 * Keyboard accessible throughout.
 */
export function ProductGallery({
  images,
  productName,
  className,
}: {
  images: ProductImage[];
  productName: string;
  className?: string;
}) {
  const sorted = [...images].sort((a, b) => a.position - b.position);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [zoomed, setZoomed] = React.useState(false);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const stripRef = React.useRef<HTMLDivElement>(null);
  const active = sorted[activeIndex] ?? sorted[0];

  // Keep the active index in sync while swiping the mobile strip.
  const onStripScroll = () => {
    const strip = stripRef.current;
    if (!strip) return;
    const index = Math.round(strip.scrollLeft / strip.clientWidth);
    if (index !== activeIndex && sorted[index]) setActiveIndex(index);
  };

  // Scroll the strip when a thumbnail/dot is chosen (keeps both views in sync).
  const select = (index: number) => {
    setActiveIndex(index);
    const strip = stripRef.current;
    if (strip) strip.scrollTo({ left: index * strip.clientWidth, behavior: "smooth" });
  };

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (zoomed && !dialog.open) dialog.showModal();
    if (!zoomed && dialog.open) dialog.close();
  }, [zoomed]);

  if (!active) {
    return <ImageArea ratio="3/4" className={className} />;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Mobile: swipeable strip */}
      <div
        ref={stripRef}
        onScroll={onStripScroll}
        className="edge-x -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:hidden"
        aria-label={`${productName} photos — swipe to browse`}
      >
        {sorted.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setZoomed(true)}
            aria-label={`Zoom photo ${index + 1} of ${sorted.length}`}
            className="w-[85%] shrink-0 snap-center"
          >
            <ImageArea ratio="3/4" placeholder={false}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.alt ?? `${productName} — photo ${index + 1}`}
                loading={index === 0 ? "eager" : "lazy"}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </ImageArea>
          </button>
        ))}
      </div>

      {/* Mobile dots */}
      {sorted.length > 1 && (
        <div
          className="flex justify-center gap-1.5 sm:hidden"
          role="tablist"
          aria-label="Photo position"
        >
          {sorted.map((image, index) => (
            <button
              key={image.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Photo ${index + 1}`}
              onClick={() => select(index)}
              className={cn(
                "size-2 rounded-full transition-colors",
                index === activeIndex ? "bg-primary" : "bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      )}

      {/* Desktop: large image with zoom */}
      <div className="hidden sm:block">
        <ImageArea ratio="3/4" placeholder={false}>
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label="Zoom photo"
            className="absolute inset-0 h-full w-full cursor-zoom-in"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={active.id}
              src={active.url}
              alt={active.alt ?? productName}
              className="absolute inset-0 h-full w-full animate-fade-up object-cover"
            />
          </button>
        </ImageArea>

        {sorted.length > 1 && (
          <div
            role="radiogroup"
            aria-label={`${productName} photos`}
            className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-4"
          >
            {sorted.map((image, index) => (
              <button
                key={image.id}
                type="button"
                role="radio"
                aria-checked={index === activeIndex}
                aria-label={`Show photo ${index + 1} of ${sorted.length}`}
                onClick={() => select(index)}
                className={cn(
                  "bg-muted relative aspect-square overflow-hidden rounded-lg border transition-all duration-200 ease-gentle",
                  index === activeIndex
                    ? "border-primary ring-ring/40 ring-2"
                    : "hover:border-ring/50 opacity-85 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Zoom lightbox — native <dialog> for correct focus/Esc/backdrop semantics.
          Click-away closing lives on a plain wrapper div (mouse convenience
          only — keyboard users have Esc and the Close button), so the
          <dialog> element itself carries no interaction handlers. */}
      <dialog
        ref={dialogRef}
        aria-label={`${productName} — zoomed photo`}
        className="fixed inset-0 z-50 m-auto max-h-full w-auto max-w-full bg-transparent p-0 backdrop:bg-background/95 backdrop:p-4 sm:backdrop:p-10"
        onClose={() => setZoomed(false)}
      >
        <div
          onClick={() => dialogRef.current?.close()}
          className="fixed inset-0 flex items-center justify-center"
        >
          <div className="relative" onClick={(event) => event.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.url}
              alt={active.alt ?? productName}
              className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-soft-lg"
            />
            <button
              type="button"
              aria-label="Close zoom"
              onClick={() => dialogRef.current?.close()}
              className="text-muted-foreground hover:text-foreground absolute -top-10 right-0 rounded-full border bg-card px-3 py-1.5 text-sm"
            >
              Close ✕
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
