"use client";

import * as React from "react";
import { useActionState, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Crown, ImagePlus, Loader2, Trash2 } from "lucide-react";

import {
  addProductImagesAction,
  deleteProductImageAction,
  reorderProductImagesAction,
  setCoverImageAction,
  updateImageAltAction,
  type ProductImagesActionState,
} from "@/app/admin/products/images";
import { SafeImage } from "@/components/product/safe-image";
import { Button } from "@/components/ui/button";
import { compressImageFile, PRODUCT_IMAGE_INPUT_MAX_BYTES } from "@/lib/compress-image";
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

const reorderButton =
  "text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring/50 inline-flex size-10 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-40 md:size-8";

const crownButton =
  "text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring/50 inline-flex size-10 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-[3px] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 md:size-8";

/** A React 19 form action: the curried dispatch from useActionState. */
type ImagesFormAction = (formData: FormData) => void | Promise<void>;

/**
 * Reject unsupported types and oversized originals before any compression
 * work starts. Mirrors the server-side rules; the last rejection wins for
 * the message, matching the previous single-error display.
 */
function selectValidImages(selected: File[]): { accepted: File[]; error: string | null } {
  const accepted: File[] = [];
  let error: string | null = null;
  for (const original of selected) {
    if (!ALLOWED_IMAGE_TYPES.includes(original.type)) {
      error = `"${original.name}" is not a supported image type. Use JPEG, PNG, WebP or AVIF.`;
      continue;
    }
    if (original.size > PRODUCT_IMAGE_INPUT_MAX_BYTES) {
      error = `"${original.name}" is larger than 25 MB.`;
      continue;
    }
    accepted.push(original);
  }
  return { accepted, error };
}

/** The position-0 photo: badge, preview and explainer. Pure display. */
function CoverCard({ cover, productName }: { cover: ManagedImage; productName: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-lg border ring-2 ring-primary/20 sm:size-24">
        <SafeImage
          src={cover.url}
          alt={cover.alt ?? `${productName} cover photo`}
          fill
          sizes="96px"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div>
        <span className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
          <Crown aria-hidden="true" className="size-3" />
          Cover
        </span>
        <p className="text-muted-foreground mt-1 text-xs">
          Shown across the shop. Promote another photo below to change it.
        </p>
      </div>
    </div>
  );
}

/**
 * One gallery row: thumb, label, move controls, set-cover, delete.
 * The row owns its two tiny forms (cover / delete) so its hidden imageId is
 * always scoped to that row — a shared form would submit every row's fields
 * and always resolve to the first photo — plus its own deleting flag for
 * the pending fade-out.
 */
function GalleryImageRow({
  image,
  index,
  galleryLength,
  productId,
  productName,
  coverAction,
  isCoverPending,
  isReordering,
  altAction,
  altSavedFor,
  onMove,
}: {
  image: ManagedImage;
  /** Index within the gallery slice (0 = first gallery photo, not the cover). */
  index: number;
  galleryLength: number;
  productId: string;
  productName: string;
  coverAction: ImagesFormAction;
  isCoverPending: boolean;
  isReordering: boolean;
  altAction: ImagesFormAction;
  /** Image id whose alt text was just saved (shows inline feedback). */
  altSavedFor: string | null;
  onMove: (delta: -1 | 1) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const photoNumber = index + 2; // 1-based, after the cover.

  return (
    <li className="p-3 sm:p-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={cn(
            "bg-muted relative size-14 shrink-0 overflow-hidden rounded-lg border sm:size-16",
            deleting && "opacity-40",
          )}
        >
          <SafeImage
            src={image.url}
            alt={image.alt ?? `${productName} photo`}
            fill
            sizes="64px"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
          {index === 0 ? "First gallery photo" : `Gallery photo ${photoNumber}`}
        </p>

        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            aria-label={`Move photo ${photoNumber} up`}
            disabled={index === 0 || isReordering}
            onClick={() => onMove(-1)}
            className={reorderButton}
          >
            <ArrowUp aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Move photo ${photoNumber} down`}
            disabled={index === galleryLength - 1 || isReordering}
            onClick={() => onMove(1)}
            className={reorderButton}
          >
            <ArrowDown aria-hidden="true" className="size-4" />
          </button>
        </div>

        {/* Set as cover — row-scoped form. */}
        <form action={coverAction}>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="imageId" value={image.id} />
          <button
            type="submit"
            disabled={isCoverPending}
            aria-label={`Set photo ${photoNumber} as cover`}
            title="Set as cover"
            className={crownButton}
          >
            {isCoverPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Crown aria-hidden="true" className="size-4" />
            )}
          </button>
        </form>

        {/* Delete — row-scoped form. */}
        <form
          action={deleteProductImageAction}
          onSubmit={(event) => {
            if (!window.confirm(`Delete this photo? This cannot be undone.`)) {
              event.preventDefault();
              return;
            }
            setDeleting(true);
          }}
        >
          <input type="hidden" name="imageId" value={image.id} />
          <input type="hidden" name="productId" value={productId} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Delete photo ${photoNumber} of ${productName}`}
          >
            <Trash2 />
            <span className="sr-only sm:not-sr-only">Delete</span>
          </Button>
        </form>
      </div>

      {/* Alt-text editor — row-scoped form under the controls. Auto-generated
          alts are placeholders; the admin refines them for screen readers. */}
      <form action={altAction} className="mt-2 flex items-center gap-2">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="imageId" value={image.id} />
        <input
          type="text"
          name="alt"
          defaultValue={image.alt ?? ""}
          maxLength={300}
          placeholder="Describe this photo for screen readers (alt text)"
          aria-label={`Alt text for photo ${photoNumber}`}
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full min-w-0 rounded-md border bg-transparent px-2.5 text-xs outline-none focus-visible:ring-[3px]"
        />
        <button
          type="submit"
          className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring/50 inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs outline-none transition-colors focus-visible:ring-[3px]"
        >
          {altSavedFor === image.id ? (
            <Check aria-hidden="true" className="size-3.5 text-emerald-600" />
          ) : (
            "Save"
          )}
        </button>
      </form>
    </li>
  );
}

/**
 * The add-photos form. It owns the optimizing/error state because nothing
 * else in the manager needs it; picked photos are optimized in the browser
 * (resize + re-encode) before upload, so the form submits small files.
 */
function AddPhotosForm({
  productId,
  state,
  formAction,
  isPending,
}: {
  productId: string;
  state: ProductImagesActionState;
  formAction: ImagesFormAction;
  isPending: boolean;
}) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);

  async function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selected = Array.from(input.files ?? []);
    if (selected.length === 0) return;
    setSelectError(null);
    setIsOptimizing(true);
    try {
      const { accepted, error } = selectValidImages(selected);
      if (error) setSelectError(error);

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
      input.files = transfer.files;
    } finally {
      setIsOptimizing(false);
    }
  }

  return (
    <form action={formAction} className="border-border rounded-xl border border-dashed p-4">
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
  );
}

/**
 * Photo management on the edit page: shows all images, adds any number of
 * new ones (multi-file, mobile picker), deletes with confirmation, reorders
 * gallery photos with explicit up/down buttons, and lets any gallery photo
 * be promoted to the cover with one tap. All controls work with touch,
 * keyboard and mouse (no drag gestures).
 *
 * Structure: this component owns only the shared photo list and reorder
 * state — the cover card, gallery rows and add-photos form are separate
 * components above, each owning their own slice of state and forms.
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
  const [coverState, coverAction, isCoverPending] = useActionState(
    setCoverImageAction,
    initialState,
  );
  const [altState, altAction] = useActionState(updateImageAltAction, initialState);
  const [order, setOrder] = useState<ManagedImage[] | null>(null);
  const [isReordering, startReorder] = useTransition();

  const sorted = React.useMemo(() => [...images].sort((a, b) => a.position - b.position), [images]);
  const [cover, ...gallery] = order ?? sorted;

  /**
   * Optimistic gallery move; persisted in a transition. Operates on the
   * gallery slice only — the cover (first item) never moves, and the
   * payload lists gallery rows as 1..n so the cover keeps position 0.
   */
  function move(galleryIndex: number, delta: -1 | 1) {
    const current = order ?? sorted;
    const target = galleryIndex + delta;
    if (target < 0 || target >= gallery.length) return;
    const nextGallery = [...current.slice(1)];
    [nextGallery[galleryIndex], nextGallery[target]] = [
      nextGallery[target],
      nextGallery[galleryIndex],
    ];
    setOrder([current[0], ...nextGallery]);
    startReorder(async () => {
      const data = new FormData();
      data.set("productId", productId);
      nextGallery.forEach((item, i) => data.append("order", `${i + 1}:${item.id}`));
      await reorderProductImagesAction(initialState, data);
    });
  }

  return (
    <section aria-labelledby="product-images-heading" className="space-y-4">
      <div>
        <h2 id="product-images-heading" className="text-sm font-semibold tracking-wide uppercase">
          Product photos ({sorted.length})
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          The cover is the first photo — shown on cards and listings. Tap a photo&apos;s crown to
          make it the cover, or use the arrows to reorder.
        </p>
      </div>

      {/* Cover (position 0). */}
      {cover && <CoverCard cover={cover} productName={productName} />}

      {gallery.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {gallery.map((image, index) => (
            <GalleryImageRow
              key={image.id}
              image={image}
              index={index}
              galleryLength={gallery.length}
              productId={productId}
              productName={productName}
              coverAction={coverAction}
              isCoverPending={isCoverPending}
              isReordering={isReordering}
              altAction={altAction}
              altSavedFor={altState.altSavedFor ?? null}
              onMove={(delta) => move(index, delta)}
            />
          ))}
        </ul>
      )}

      {/* Reorder feedback — transition errors surface here too. */}
      {isReordering && (
        <p className="text-muted-foreground text-xs" role="status">
          Saving new order…
        </p>
      )}

      {/* Alt-save feedback: success is per-row (Check icon); a failure is
          global to the manager but must never be silent. */}
      {altState.error && (
        <p className="text-destructive text-sm" role="alert">
          {altState.error}
        </p>
      )}

      {/* Cover-change feedback lives outside the list so it survives re-renders. */}
      {coverState.error && (
        <p className="text-destructive text-sm" role="alert">
          {coverState.error}
        </p>
      )}
      {coverState.newCoverUrl && (
        <p className="text-emerald-600 flex items-center gap-1.5 text-sm" role="status">
          <Check aria-hidden="true" className="size-4" />
          Cover photo updated — it now shows across the shop.
        </p>
      )}

      <AddPhotosForm
        productId={productId}
        state={state}
        formAction={formAction}
        isPending={isPending}
      />
    </section>
  );
}
