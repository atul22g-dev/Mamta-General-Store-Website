"use client";

import * as React from "react";
import { useActionState } from "react";
import { Check, ImageOff, Loader2, Trash2, Upload } from "lucide-react";

import {
  removeHeroImageAction,
  uploadHeroImageAction,
  type HeroImageState,
} from "@/app/admin/homepage/actions";
import { compressImageFile, PRODUCT_IMAGE_INPUT_MAX_BYTES } from "@/lib/compress-image";
import { SafeImage } from "@/components/product/safe-image";

const initialState: HeroImageState = {};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Hero-image manager (Admin → Homepage): shows the current hero image,
 * lets the admin upload a replacement (compressed in the browser first)
 * or remove it (the storefront falls back to its placeholder). Optimistic
 * preview update on success; failures surface inline.
 */
export function HeroImageManager({ initialUrl }: { initialUrl: string | null }) {
  const [url, setUrl] = React.useState(initialUrl);
  const [isUploading, setIsUploading] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [uploadState, uploadAction, uploadPending] = useActionState(
    async (prev: HeroImageState, formData: FormData) => {
      const result = await uploadHeroImageAction(prev, formData);
      if (result.ok) setUrl(result.imageUrl ?? null);
      return result;
    },
    initialState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    async (prev: HeroImageState, formData: FormData) => {
      const result = await removeHeroImageAction(prev, formData);
      if (result.ok) setUrl(null);
      return result;
    },
    initialState,
  );

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    setFileError(null);
    const selected = input.files?.[0];
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setFileError("Use JPEG, PNG, WebP or AVIF.");
      input.value = "";
      return;
    }
    if (selected.size > PRODUCT_IMAGE_INPUT_MAX_BYTES) {
      setFileError("That photo is larger than 25 MB.");
      input.value = "";
      return;
    }
    setIsUploading(true);
    try {
      const optimized = await compressImageFile(selected);
      const transfer = new DataTransfer();
      transfer.items.add(optimized);
      input.files = transfer.files;
      // Submit the enclosing form programmatically with the optimized file.
      input.form?.requestSubmit();
    } finally {
      setIsUploading(false);
    }
  }

  const pending = uploadPending || removePending || isUploading;
  const error = uploadState.error ?? removeState.error ?? fileError;

  return (
    <div className="space-y-4">
      {/* Current image / empty state */}
      {url ? (
        <div className="bg-muted relative aspect-[16/10] w-full overflow-hidden rounded-xl border">
          <SafeImage
            src={url}
            alt="Current homepage hero image"
            fill
            sizes="(min-width: 768px) 576px, 100vw"
            className="absolute inset-0 object-cover"
          />
        </div>
      ) : (
        <div className="bg-muted/50 text-muted-foreground flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed">
          <ImageOff aria-hidden="true" className="size-6" />
          <p className="text-sm">No hero image set</p>
          <p className="text-muted-foreground max-w-xs text-center text-xs">
            The homepage shows its built-in placeholder. Upload a photo to feature the shop.
          </p>
        </div>
      )}

      {uploadState.ok && (
        <p role="status" className="flex items-center gap-1.5 text-sm">
          <Check aria-hidden="true" className="size-4" />
          Hero image updated — the homepage now shows it.
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <form action={uploadAction}>
          <input type="hidden" name="kind" value="hero" />
          <label
            className={cnUploadLabel(pending)}
            aria-disabled={pending}
          >
            {pending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Upload aria-hidden="true" className="size-4" />
            )}
            {url ? "Replace image" : "Upload image"}
            <input
              ref={fileInputRef}
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              disabled={pending}
              onChange={handleFileChange}
            />
          </label>
        </form>

        {url && (
          <form action={removeAction}>
            <button
              type="submit"
              disabled={pending}
              className="border-input text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Remove
            </button>
          </form>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        JPEG, PNG, WebP or AVIF · large photos are compressed automatically · minimum 400×400
        pixels · shown large on the homepage, so use a wide, well-lit photo.
      </p>
    </div>
  );
}

function cnUploadLabel(pending: boolean): string {
  return [
    "bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
    pending ? "opacity-60" : "",
  ].join(" ");
}
