import * as React from "react";
import { Image as ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * High-quality product-image area.
 *
 * A quiet, consistent surface for product photography: soft background, subtle
 * border, rounded corners and a gentle shadow. Shows a centered placeholder
 * icon when there is no image yet (next/image integration arrives with real
 * product data). Use `ratio` to lock the frame; images are always object-cover.
 */
const ratios = {
  "3/4": "aspect-[3/4]",
  "4/5": "aspect-[4/5]",
  "1/1": "aspect-square",
  "4/3": "aspect-[4/3]",
  "16/9": "aspect-video",
} as const;

interface ImageAreaProps extends React.ComponentProps<"div"> {
  /** Frame aspect ratio — 3/4 is the fashion-catalog default. */
  ratio?: keyof typeof ratios;
  /** Render the placeholder icon (default: true when no image is provided). */
  placeholder?: boolean;
}

function ImageArea({ className, ratio = "3/4", placeholder, children, ...props }: ImageAreaProps) {
  const showPlaceholder = placeholder ?? !children;

  return (
    <div
      data-slot="image-area"
      className={cn(
        "group/image-area relative flex w-full items-center justify-center overflow-hidden rounded-xl border bg-muted shadow-soft",
        ratios[ratio],
        className,
      )}
      {...props}
    >
      {children}
      {showPlaceholder && (
        <ImageIcon
          aria-hidden="true"
          strokeWidth={1}
          className="size-8 text-muted-foreground/50 transition-transform duration-300 ease-gentle group-hover/image-area:scale-105"
        />
      )}
    </div>
  );
}

export { ImageArea };
