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
import { compressImageFile, PRODUCT_IMAGE_INPUT_MAX_BYTES } from "@/lib/images/compress-image";
import { cn } from "@/lib/utils";

export interface ManagedImage {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}

const initialState: ProductImagesActionState = {};

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
/** Per-file cap for the optimized file (mirrors the server-side rule). */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Product gallery manager (edit page): shows all images, adds any number of
 * new ones (multi-file), deletes individual images with confirmation. The
 * position-0 primary image is shown too but its replacement lives in the
 * main product form. Picked photos are optimized in the browser (resize +
 * re-encode, all accepted files together) before upload.
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
  const [isOptimizing, setIsOptimizing] = React.useState(false);
  const [selectError, setSelectError] = React.useState<string | null>(null);
  const sorted = [...images].sort((a, b) => a.position - b.position);

  /**
   * Photos are optimized in the browser (resize + re-encode) before upload:
   * the picked files are swapped for their compressed versions right in the
   * input, so the form submits the small files, not the originals.
   */
  async function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selected = Array.from(input.files ?? []);
    if (selected.length === 0) return;
    setSelectError(null);
    setIsOptimizing(true);
    try {
      // Validate first, then optimize the accepted files together —
      // compression is independent per photo, so none waits for the previous.
      const accepted: File[] = [];
      for (const original of selected) {
        if (!ALLOWED_IMAGE_TYPES.includes(original.type)) {
          setSelectError(
            `"${original.name}" is not a supported image type. Use JPEG, PNG, WebP or AVIF.`,
          );
          continue;
        }
        if (original.size > PRODUCT_IMAGE_INPUT_MAX_BYTES) {
          setSelectError(`"${original.name}" is larger than 25 MB.`);
          continue;
        }
        accepted.push(original);
      }

      const optimized = await Promise.all(accepted.map((file) => compressImageFile(file)));

      const transfer = new DataTransfer();
      for (const file of optimized) {
        if (file.size > MAX_IMAGE_BYTES) {
          setSelectError(
            `"${file.name}" is still larger than 5 MB after optimization — try a smaller photo.`,
          );
          continue;
        }
        transfer.items.add(file);
      }
      // Replace the selection with the optimized files (an empty transfer
      // clears the input, re-triggering the required validation on submit).
      input.files = transfer.files;
    } finally {
      setIsOptimizing(false);
    }
  }

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
          JPEG, PNG, WebP or AVIF · large photos are compressed automatically · up to 8 at a time
        </p>
        <input
          id="gallery-images"
          name="imageFiles"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          required
          disabled={isOptimizing}
          onChange={handleFilesChange}
          className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-secondary/70"
        />
        {isOptimizing && (
          <p role="status" className="text-muted-foreground mt-2 text-sm">
            Optimizing images…
          </p>
        )}
        {selectError && (
          <p className="text-destructive mt-2 text-sm" role="alert">
            {selectError}
          </p>
        )}
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
        <Button type="submit" size="sm" className="mt-3" disabled={isPending || isOptimizing}>
          {isPending ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {isPending ? "Uploading…" : "Upload photos"}
        </Button>
      </form>
    </section>
  );
}
