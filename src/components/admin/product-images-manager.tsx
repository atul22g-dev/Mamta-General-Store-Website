"use client";

import * as React from "react";
import { useActionState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import {
  addProductImagesAction,
  deleteProductImageAction,
  type ProductImagesActionState,
} from "@/app/admin/products/images";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ManagedImage {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}

const initialState: ProductImagesActionState = {};

/**
 * Product gallery manager (edit page): shows all images, adds any number of
 * new ones (multi-file), deletes individual images with confirmation. The
 * position-0 primary image is shown too but its replacement lives in the
 * main product form.
 */
export function ProductImagesManager({
  productId,
  productName,
  images,
}: {
  productId: string;
  productName: string;
  images: ManagedImage[];
}) {
  const [state, formAction, isPending] = useActionState(addProductImagesAction, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const sorted = [...images].sort((a, b) => a.position - b.position);

  return (
    <section aria-labelledby="product-images-heading" className="space-y-4">
      <div>
        <h2 id="product-images-heading" className="text-sm font-semibold tracking-wide uppercase">
          Product photos ({sorted.length})
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Front, detail, fabric and design photos help customers choose. The first photo is the
          cover used across the shop.
        </p>
      </div>

      {sorted.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {sorted.map((image) => (
            <li key={image.id} className="group relative">
              <div
                className={cn(
                  "bg-muted relative aspect-square overflow-hidden rounded-lg border",
                  deletingId === image.id && "opacity-40",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.alt ?? `${productName} photo`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {image.position === 0 && (
                  <span className="bg-primary text-primary-foreground absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium">
                    Cover
                  </span>
                )}
              </div>
              <form action={deleteProductImageAction} className="mt-1.5">
                <input type="hidden" name="imageId" value={image.id} />
                <input type="hidden" name="productId" value={productId} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive w-full"
                  aria-label={`Delete photo ${image.position + 1} of ${productName}`}
                  onClick={(event) => {
                    if (!window.confirm(`Delete this photo? This cannot be undone.`)) {
                      event.preventDefault();
                      return;
                    }
                    setDeletingId(image.id);
                  }}
                >
                  <Trash2 />
                  Delete
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        action={formAction}
        onSubmit={() => {
          // Let the browser validate nothing extra; pending state shows below.
        }}
        className="border-border rounded-xl border border-dashed p-4"
      >
        <input type="hidden" name="productId" value={productId} />
        <label htmlFor="gallery-images" className="text-sm font-medium">
          Add photos
        </label>
        <p className="text-muted-foreground mt-0.5 text-xs">
          JPEG, PNG, WebP or AVIF · up to 5 MB each · up to 8 at a time
        </p>
        <input
          id="gallery-images"
          name="imageFiles"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          required
          className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/70"
        />
        {state.error && (
          <p className="text-destructive mt-2 text-sm" role="alert">
            {state.error}
          </p>
        )}
        {state.added != null && state.added > 0 && (
          <p className="text-emerald-600 mt-2 text-sm" role="status">
            Added {state.added} photo{state.added === 1 ? "" : "s"}.
          </p>
        )}
        <Button type="submit" size="sm" className="mt-3" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {isPending ? "Uploading…" : "Upload photos"}
        </Button>
      </form>
    </section>
  );
}
