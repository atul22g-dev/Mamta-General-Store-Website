"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";

import type { ProductImage } from "@/types/product";
import { cn } from "@/lib/utils";
import { ImageArea } from "@/components/ui/image-area";
import { SafeImage } from "@/components/product/safe-image";

/** File name for a downloaded photo: "<product>-photo-<n>.<ext>". */
function downloadFileName(productName: string, index: number, url: string): string {
  let ext = "jpg";
  try {
    const candidate = new URL(url, window.location.href).pathname.split(".").pop() ?? "";
    if (/^[a-z0-9]{2,5}$/i.test(candidate)) ext = candidate.toLowerCase();
  } catch {
    // Keep the default extension when the URL cannot be parsed.
  }
  const slug = productName
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "product"}-photo-${index + 1}.${ext}`;
}

/**
 * Product image gallery:
 * - Mobile: swipeable strip (scroll-snap) with dots.
 * - Desktop: large image + thumbnail buttons.
 * - Click/tap the large image to zoom (lightbox, Esc/close to dismiss) with
 *   a download action for the opened photo.
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
  const [downloadingUrl, setDownloadingUrl] = React.useState<string | null>(null);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const stripRef = React.useRef<HTMLDivElement>(null);
  const active = sorted[activeIndex] ?? sorted[0];

  /**
   * Download the zoomed photo. The images live on Supabase Storage (another
   * origin), where the plain `download` attribute is ignored — so the file
   * is fetched as a blob and saved via an object URL. If that fetch is
   * blocked (CORS/network), the photo opens in a new tab where the browser's
   * own save controls work.
   */
  async function downloadImage(url: string) {
    if (downloadingUrl) return;
    setDownloadingUrl(url);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = downloadFileName(productName, activeIndex + 1, url);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingUrl(null);
    }
  }

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

  /** Lightbox navigation — wraps around; select() keeps strip/thumbnails in sync. */
  const showPrevPhoto = () => select((activeIndex - 1 + sorted.length) % sorted.length);
  const showNextPhoto = () => select((activeIndex + 1) % sorted.length);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (zoomed && !dialog.open) dialog.showModal();
    if (!zoomed && dialog.open) dialog.close();
  }, [zoomed]);

  // Scroll lock while the fullscreen photo is open: the page scrollbar
  // disappears and the background cannot scroll behind the dialog.
  React.useEffect(() => {
    if (!zoomed) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
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
        className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden"
        aria-label={`${productName} photos — swipe to browse`}
      >
        {sorted.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => {
              // Open the lightbox on THIS slide's photo. The scroll handler
              // tracks activeIndex while swiping but can lag a slide on fast
              // scrolls, so slides must not rely on the tracked index.
              setActiveIndex(index);
              setZoomed(true);
            }}
            aria-label={`Zoom photo ${index + 1} of ${sorted.length}`}
            className="w-[85%] shrink-0 snap-center"
          >
            <ImageArea ratio="3/4" placeholder={false}>
              <SafeImage
                key={image.id}
                src={image.url}
                alt={image.alt ?? `${productName} — photo ${index + 1}`}
                eager={index === 0}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </ImageArea>
          </button>
        ))}
      </div>

      {/* Mobile dots — 16px targets (32px effective with padding) for touch. */}
      {sorted.length > 1 && (
        <div
          className="flex justify-center gap-1 sm:hidden"
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
              className="flex size-5 items-center justify-center"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 rounded-full transition-colors",
                  index === activeIndex ? "bg-primary" : "bg-muted-foreground/30",
                )}
              />
            </button>
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
            <SafeImage
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
                <SafeImage
                  key={image.id}
                  src={image.url}
                  alt=""
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
        onKeyDown={(event) => {
          // Arrow keys navigate while the lightbox is open (focus lives
          // inside the native dialog, so this fires reliably).
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            showPrevPhoto();
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            showNextPhoto();
          }
        }}
      >
        <div
          onClick={() => dialogRef.current?.close()}
          className="fixed inset-0 flex items-center justify-center"
        >
          <div className="relative" onClick={(event) => event.stopPropagation()}>
            <SafeImage
              key={active.id}
              src={active.url}
              alt={active.alt ?? productName}
              className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-soft-lg animate-fade-up"
            />

            {/* Prev/next arrows — only with more than one photo; overlay the
                photo edges, centered vertically, 44px touch targets. */}
            {sorted.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={showPrevPhoto}
                  aria-label="Previous photo"
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 left-2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border bg-card/90 shadow-soft outline-none backdrop-blur-sm transition-colors focus-visible:ring-[3px] active:scale-[0.97] sm:left-3"
                >
                  <ChevronLeft aria-hidden="true" className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={showNextPhoto}
                  aria-label="Next photo"
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border bg-card/90 shadow-soft outline-none backdrop-blur-sm transition-colors focus-visible:ring-[3px] active:scale-[0.97] sm:right-3"
                >
                  <ChevronRight aria-hidden="true" className="size-5" />
                </button>
              </>
            )}

            <div className="absolute -top-14 right-0 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => void downloadImage(active.url)}
                disabled={downloadingUrl !== null}
                aria-label={`Download photo ${activeIndex + 1} of ${productName}`}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-11 items-center gap-1.5 rounded-full border bg-card px-4 text-sm outline-none transition-colors focus-visible:ring-[3px] active:scale-[0.97] disabled:opacity-60"
              >
                {downloadingUrl === active.url ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Download aria-hidden="true" className="size-4" />
                )}
                {downloadingUrl === active.url ? "Preparing…" : "Download"}
              </button>
              <button
                type="button"
                aria-label="Close zoom"
                onClick={() => dialogRef.current?.close()}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-11 items-center rounded-full border bg-card px-4 text-sm outline-none transition-colors focus-visible:ring-[3px] active:scale-[0.97]"
              >
                Close ✕
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
