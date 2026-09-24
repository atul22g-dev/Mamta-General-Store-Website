"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import type { AdminProductDetail } from "@/lib/admin-products";
import { saveProductAction, type ProductFormState } from "@/app/admin/products/actions";
import { slugifyName } from "@/lib/validation/product";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CategoryOption {
  id: string;
  name: string;
}

const initialState: ProductFormState = {};

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="text-destructive mt-1.5 text-xs">
      {errors[0]}
    </p>
  );
}

const inputInvalid = (errors?: string[]) => (errors?.length ? { "aria-invalid": true } : {});

/**
 * Image-upload state: client-side type/size validation mirrors the server
 * rules. The selected (valid) File is held in state; the preview element
 * (see ImagePreview) renders it and owns the object-URL lifecycle.
 */
function useProductImage() {
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [imageFileError, setImageFileError] = React.useState<string | null>(null);

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setImageFileError(null);
      setPendingFile(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageFileError("Unsupported image type. Use JPEG, PNG, WebP or AVIF.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageFileError("Image is larger than 5 MB.");
      event.target.value = "";
      return;
    }

    setImageFileError(null);
    setPendingFile(file);
  }

  return { pendingFile, imageFileError, handleImageChange };
}

/**
 * Live preview of the selected file. Rendered as a FileReader data URL —
 * unlike a Blob object URL, a data URL needs no revocation lifecycle, so the
 * preview can never leak a pinned file. With no file selected, the stored
 * image (edit mode) shows instead.
 */
function ImagePreview({ file, fallbackUrl }: { file: File | null; fallbackUrl: string }) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) return;
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => {
      if (!cancelled && typeof reader.result === "string") {
        setDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    return () => {
      cancelled = true;
    };
  }, [file]);

  const src = file ? dataUrl : fallbackUrl;
  if (!src) return null;

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- local preview only */
    <img
      src={src}
      alt="Selected product preview"
      className="mt-2 max-h-48 rounded-lg border object-contain"
    />
  );
}

/**
 * Basics: name, slug, category, description. Owns the auto-slug logic — the
 * slug follows the name until the admin hand-edits it (a ref, since that
 * flag is never rendered).
 */
function BasicsSection({
  product,
  categories,
  errors,
  isPending,
}: {
  product: AdminProductDetail | undefined;
  categories: CategoryOption[];
  errors: ProductFormState["errors"];
  isPending: boolean;
}) {
  const [name, setName] = React.useState(product?.name ?? "");
  const [slug, setSlug] = React.useState(product?.slug ?? "");
  const [categoryId, setCategoryId] = React.useState(product?.categoryId ?? "");
  const slugEditedRef = React.useRef(Boolean(product));

  return (
    <fieldset className="space-y-5" disabled={isPending}>
      <legend className="mb-3 text-sm font-semibold tracking-wide uppercase">Basics</legend>

      <div className="space-y-2">
        <Label htmlFor="name">Product name *</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEditedRef.current) setSlug(slugifyName(event.target.value));
          }}
          required
          maxLength={120}
          aria-describedby={errors?.name ? "name-error" : undefined}
          {...inputInvalid(errors?.name)}
        />
        <div id="name-error">
          <FieldError errors={errors?.name} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">URL slug</Label>
        <Input
          id="slug"
          name="slug"
          value={slug}
          onChange={(event) => {
            slugEditedRef.current = true;
            setSlug(event.target.value);
          }}
          placeholder="auto-generated from the name"
          aria-describedby="slug-hint"
          {...inputInvalid(errors?.slug)}
        />
        <p id="slug-hint" className="text-muted-foreground text-xs">
          Storefront URL: /products/{slug || "…"}
        </p>
        <FieldError errors={errors?.slug} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="categoryId">Category *</Label>
        <Select name="categoryId" value={categoryId} onValueChange={setCategoryId} required>
          <SelectTrigger id="categoryId" aria-invalid={Boolean(errors?.categoryId)}>
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError errors={errors?.categoryId} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={product?.description ?? ""}
          maxLength={5000}
          {...inputInvalid(errors?.description)}
        />
        <FieldError errors={errors?.description} />
      </div>
    </fieldset>
  );
}

/** Pricing & inventory: price, original price, stock. */
function PricingInventorySection({
  product,
  errors,
  isPending,
}: {
  product: AdminProductDetail | undefined;
  errors: ProductFormState["errors"];
  isPending: boolean;
}) {
  return (
    <fieldset className="space-y-5" disabled={isPending}>
      <legend className="mb-3 text-sm font-semibold tracking-wide uppercase">
        Pricing &amp; inventory
      </legend>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price">Selling price (₹) *</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min="1"
            step="0.01"
            placeholder="1999"
            defaultValue={product ? (product.price / 100).toString() : ""}
            required
            {...inputInvalid(errors?.price)}
          />
          <FieldError errors={errors?.price} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="discountPrice">Original price (₹)</Label>
          <Input
            id="discountPrice"
            name="discountPrice"
            type="number"
            min="1"
            step="0.01"
            placeholder="shown struck-through for % off"
            defaultValue={product?.discountPrice ? (product.discountPrice / 100).toString() : ""}
            {...inputInvalid(errors?.discountPrice)}
          />
          <FieldError errors={errors?.discountPrice} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock">Stock</Label>
          <Input
            id="stock"
            name="stock"
            type="number"
            min="0"
            step="1"
            placeholder="empty = not tracked"
            defaultValue={product?.stock ?? ""}
            {...inputInvalid(errors?.stock)}
          />
          <FieldError errors={errors?.stock} />
        </div>
      </div>
    </fieldset>
  );
}

/** Image & visibility: upload with live preview, URL fallback, toggle switches. */
function ImageVisibilitySection({
  product,
  errors,
  isPending,
}: {
  product: AdminProductDetail | undefined;
  errors: ProductFormState["errors"];
  isPending: boolean;
}) {
  const { pendingFile, imageFileError, handleImageChange } = useProductImage();

  return (
    <fieldset className="space-y-5" disabled={isPending}>
      <legend className="mb-3 text-sm font-semibold tracking-wide uppercase">
        Image &amp; visibility
      </legend>

      <div className="space-y-2">
        <Label htmlFor="imageFile">Product image</Label>
        <Input
          id="imageFile"
          name="imageFile"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handleImageChange}
          aria-invalid={Boolean(imageFileError)}
          {...(imageFileError ? { "aria-describedby": "image-file-error" } : {})}
        />
        <p id="image-file-hint" className="text-muted-foreground text-xs">
          JPEG, PNG, WebP or AVIF — up to 5 MB. Stored in Supabase Storage.
        </p>
        {imageFileError && (
          <p id="image-file-error" role="alert" className="text-destructive text-xs">
            {imageFileError}
          </p>
        )}
        <ImagePreview file={pendingFile} fallbackUrl={product?.imageUrl ?? ""} />
        <FieldError errors={errors?.imageUrl} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="imageUrl">…or use an image URL</Label>
        <Input
          id="imageUrl"
          name="imageUrl"
          type="url"
          placeholder="https://…"
          defaultValue={product?.imageUrl ?? ""}
          {...inputInvalid(errors?.imageUrl)}
        />
        <p className="text-muted-foreground text-xs">Used when no file is uploaded above.</p>
        <FieldError errors={errors?.imageUrl} />
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            name="active"
            defaultChecked={product?.active ?? false}
            className="accent-[var(--primary)] size-4 rounded"
          />
          Active (visible on the storefront)
        </label>
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={product?.featured ?? false}
            className="accent-[var(--primary)] size-4 rounded"
          />
          Featured on the homepage
        </label>
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            name="isNewArrival"
            defaultChecked={product?.isNewArrival ?? false}
            className="accent-[var(--primary)] size-4 rounded"
          />
          Mark as New Arrival
        </label>
      </div>
    </fieldset>
  );
}

/** Submit/cancel footer with the saving spinner and mode-aware label. */
function FormActions({ isPending, isEdit }: { isPending: boolean; isEdit: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" asChild disabled={isPending}>
        <Link href="/admin/products">Cancel</Link>
      </Button>
      <Button type="submit" disabled={isPending} className="sm:min-w-40">
        {isPending ? (
          <>
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Saving…
          </>
        ) : isEdit ? (
          "Save changes"
        ) : (
          "Create product"
        )}
      </Button>
    </div>
  );
}

/**
 * Create/edit product form. Client-side niceties (auto-slug, image preview)
 * on top of authoritative server-side zod validation — invalid data never
 * saves. Used by both /admin/products/new and /admin/products/[id]/edit.
 */
export function ProductForm({
  categories,
  product,
}: {
  categories: CategoryOption[];
  /** Present in edit mode. */
  product?: AdminProductDetail;
}) {
  const [state, formAction, isPending] = useActionState(saveProductAction, initialState);
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-8">
      {product && <input type="hidden" name="id" value={product.id} />}

      {state.formError && (
        <div
          role="alert"
          className="text-destructive bg-destructive/10 flex items-start gap-2 rounded-lg px-4 py-3 text-sm"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.formError}
        </div>
      )}

      <BasicsSection
        product={product}
        categories={categories}
        errors={errors}
        isPending={isPending}
      />
      <PricingInventorySection product={product} errors={errors} isPending={isPending} />
      <ImageVisibilitySection product={product} errors={errors} isPending={isPending} />

      <FormActions isPending={isPending} isEdit={Boolean(product)} />
    </form>
  );
}
