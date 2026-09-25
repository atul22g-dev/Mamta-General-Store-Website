"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import type { AdminProductDetail } from "@/lib/admin-products";
import { saveProductAction, type ProductFormState } from "@/app/admin/products/actions";
import { slugifyName, type ProductFormData } from "@/lib/validation/product";
import { compressImageFile, PRODUCT_IMAGE_INPUT_MAX_BYTES } from "@/lib/images/compress-image";
import { cn } from "@/lib/utils";
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
/** Mirrors the server-side cap in the save action. */
const MAX_PRODUCT_IMAGES = 5;

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="text-destructive mt-1.5 text-xs">
      {errors[0]}
    </p>
  );
}

const inputInvalid = (errors?: string[]) => (errors?.length ? { "aria-invalid": true } : {});

/** A selected photo plus the stable id React keys on (assigned at pick time). */
interface SelectedImage {
  id: string;
  file: File;
}

/** Stable per-item id; randomUUID where available, unique fallback elsewhere. */
function newImageId(): string {
  return crypto.randomUUID?.() ?? `img-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Multi-image upload state (up to 5). Client-side type/size validation
 * mirrors the server rules; invalid files are skipped with a message. Photos
 * are optimized in the browser (resize + re-encode) at selection time — all
 * accepted files together, since compression is independent per photo — so
 * the previews and the hidden input the form submits carry the compressed
 * files. Each preview element (see FileImagePreview) renders its own file
 * and owns its reader lifecycle.
 */
function useProductImages() {
  const [files, setFiles] = React.useState<SelectedImage[]>([]);
  const [filesError, setFilesError] = React.useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = React.useState(false);

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    // Materialize before the first await: the caller clears the picker right
    // after this call, which detaches the FileList.
    const selected = Array.from(list);
    setFilesError(null);
    setIsOptimizing(true);
    try {
      // Validate everything first, then optimize the accepted files together.
      const remaining = MAX_PRODUCT_IMAGES - files.length;
      const accepted: SelectedImage[] = [];
      for (const original of selected) {
        if (accepted.length >= remaining) {
          setFilesError(`Up to ${MAX_PRODUCT_IMAGES} images can be added.`);
          break;
        }
        if (!ALLOWED_IMAGE_TYPES.includes(original.type)) {
          setFilesError(
            `"${original.name}" is not a supported image type. Use JPEG, PNG, WebP or AVIF.`,
          );
          continue;
        }
        if (original.size > PRODUCT_IMAGE_INPUT_MAX_BYTES) {
          setFilesError(`"${original.name}" is larger than 25 MB.`);
          continue;
        }
        accepted.push({ id: newImageId(), file: original });
      }

      // Resize/compress in the browser before anything is uploaded.
      const optimized = await Promise.all(
        accepted.map(async (item) => ({ ...item, file: await compressImageFile(item.file) })),
      );

      const next = [...files];
      for (const item of optimized) {
        if (item.file.size > MAX_IMAGE_BYTES) {
          setFilesError(
            `"${item.file.name}" is still larger than 5 MB after optimization — try a smaller photo.`,
          );
          continue;
        }
        next.push(item);
      }
      setFiles(next);
    } finally {
      setIsOptimizing(false);
    }
  }

  function removeAt(id: string) {
    setFiles((current) => current.filter((item) => item.id !== id));
  }

  return { files, filesError, isOptimizing, addFiles, removeAt };
}

/**
 * Live preview of one selected file, rendered as a FileReader data URL —
 * unlike a Blob object URL, a data URL needs no revocation lifecycle, so
 * previews can never leak a pinned file.
 */
function FileImagePreview({ file }: { file: File }) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
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

  if (!dataUrl) {
    return <div aria-hidden="true" className="size-20 animate-pulse rounded-lg border bg-muted" />;
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- local preview only */
    <img src={dataUrl} alt="" className="size-20 rounded-lg border object-cover" />
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
        <Label htmlFor="sku">SKU (optional)</Label>
        <Input
          id="sku"
          name="sku"
          defaultValue={product?.sku ?? ""}
          maxLength={60}
          placeholder="e.g. MGS-SUIT-001"
          aria-describedby="sku-hint"
          {...inputInvalid(errors?.sku)}
        />
        <p id="sku-hint" className="text-muted-foreground text-xs">
          Your own product code — shown only in the admin list.
        </p>
        <FieldError errors={errors?.sku} />
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

/** Pricing: selling price and original price. */
function PricingSection({
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
      <legend className="mb-3 text-sm font-semibold tracking-wide uppercase">Pricing</legend>

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
      </div>
    </fieldset>
  );
}

/**
 * Inventory: availability is a deliberate choice, not just a number.
 * - Always available — no stock counting (stored as NULL; the pre-existing
 *   behavior for every product).
 * - Out of stock — flips the storefront to its "Out of stock" state while
 *   keeping the product visible (stored as 0).
 * - Track quantity — a real count that decrements with each order.
 */
const STOCK_MODES = {
  untracked: "Always available",
  out_of_stock: "Out of stock",
  quantity: "Track quantity",
} as const;

function StockSection({
  product,
  errors,
  isPending,
}: {
  product: AdminProductDetail | undefined;
  errors: ProductFormState["errors"];
  isPending: boolean;
}) {
  const initialMode: ProductFormData["stockMode"] =
    product == null
      ? "untracked"
      : product.stock === null
        ? "untracked"
        : product.stock === 0
          ? "out_of_stock"
          : "quantity";
  const [mode, setMode] = React.useState<ProductFormData["stockMode"]>(initialMode);

  return (
    <fieldset className="space-y-5" disabled={isPending}>
      <legend className="mb-3 text-sm font-semibold tracking-wide uppercase">Stock</legend>

      <div role="radiogroup" aria-label="Stock handling" className="grid gap-2.5 sm:grid-cols-3">
        {(Object.keys(STOCK_MODES) as (keyof typeof STOCK_MODES)[]).map((value) => {
          const selected = mode === value;
          return (
            <label
              key={value}
              className={cn(
                "focus-within:ring-ring/50 flex cursor-pointer items-start gap-2.5 rounded-lg border p-3.5 text-sm transition-colors",
                selected
                  ? "border-primary bg-accent/40"
                  : "hover:border-foreground/20 hover:bg-accent/20",
              )}
            >
              <input
                type="radio"
                name="stockMode"
                value={value}
                checked={selected}
                onChange={() => setMode(value)}
                className="accent-[var(--primary)] mt-0.5 size-4 shrink-0"
              />
              <span>
                <span className="block font-medium">{STOCK_MODES[value]}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                  {value === "untracked" && "No stock counting — always sellable"}
                  {value === "out_of_stock" && "Visible, but can't be ordered right now"}
                  {value === "quantity" && "Decreases with every order placed"}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {mode === "quantity" && (
        <div className="max-w-48 space-y-2">
          <Label htmlFor="stock">Quantity in stock</Label>
          <Input
            id="stock"
            name="stock"
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 12"
            defaultValue={product?.stock != null ? String(product.stock) : ""}
            required
            {...inputInvalid(errors?.stock)}
          />
          <p className="text-muted-foreground text-xs">
            Each order reduces this by the quantity bought; it reaches 0 → out of stock.
          </p>
          <FieldError errors={errors?.stock} />
        </div>
      )}
      {mode === "out_of_stock" && (
        <p className="text-muted-foreground max-w-prose text-xs">
          The product stays listed but shows an “Out of stock” notice and the order buttons are
          disabled until you switch back.
        </p>
      )}
    </fieldset>
  );
}

/** Image & visibility: multi-upload with live previews, URL fallback, toggles. */
function ImageVisibilitySection({
  product,
  errors,
  isPending,
}: {
  product: AdminProductDetail | undefined;
  errors: ProductFormState["errors"];
  isPending: boolean;
}) {
  const { files, filesError, isOptimizing, addFiles, removeAt } = useProductImages();
  const isEdit = Boolean(product);

  /**
   * The visible picker is cleared after each selection (so the same file can
   * be re-picked), which means the browser never submits those files with
   * the form. A hidden file input mirrors the accumulated selection via
   * DataTransfer and is the field the form actually submits.
   */
  const filesInputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const input = filesInputRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    for (const item of files) transfer.items.add(item.file);
    input.files = transfer.files;
  }, [files]);

  return (
    <fieldset className="space-y-5" disabled={isPending}>
      <legend className="mb-3 text-sm font-semibold tracking-wide uppercase">
        Image &amp; visibility
      </legend>

      <div className="space-y-2">
        <Label htmlFor="imageFiles">
          Product images{files.length > 0 ? ` (${files.length}/${MAX_PRODUCT_IMAGES})` : ""}
        </Label>
        <Input
          id="imageFiles"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={isOptimizing || files.length >= MAX_PRODUCT_IMAGES}
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = ""; // allow re-selecting the same file
          }}
        />
        {/* The picker above is cleared on change; the form submits this hidden
            input, kept in sync with the accumulated selection. */}
        <input
          ref={filesInputRef}
          type="file"
          name="imageFiles"
          multiple
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
        <p id="image-files-hint" className="text-muted-foreground text-xs">
          Up to {MAX_PRODUCT_IMAGES} images — JPEG, PNG, WebP or AVIF. Large photos are resized and
          compressed automatically before upload. The first image is the cover
          {isEdit
            ? " (uploading replaces it; extra photos are added to the gallery)"
            : " shown on cards and listings"}
          . Stored in Supabase Storage.
        </p>
        {isOptimizing && (
          <p role="status" className="text-muted-foreground text-xs">
            Optimizing images…
          </p>
        )}
        {filesError && (
          <p role="alert" className="text-destructive text-xs">
            {filesError}
          </p>
        )}

        {files.length > 0 && (
          <ul className="flex flex-wrap gap-3 pt-1">
            {files.map((item, index) => (
              <li key={item.id} className="relative">
                <FileImagePreview file={item.file} />
                {index === 0 && (
                  <span className="bg-primary text-primary-foreground absolute -top-2 left-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(item.id)}
                  aria-label={`Remove ${item.file.name}`}
                  className="bg-background hover:bg-destructive hover:text-destructive-foreground absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border text-sm shadow-xs transition-colors"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {!isEdit && <FieldError errors={errors?.imageUrl} />}
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
        <p className="text-muted-foreground text-xs">Used when no files are uploaded above.</p>
        {isEdit && <FieldError errors={errors?.imageUrl} />}
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
      <PricingSection product={product} errors={errors} isPending={isPending} />
      <StockSection product={product} errors={errors} isPending={isPending} />
      <ImageVisibilitySection product={product} errors={errors} isPending={isPending} />

      <FormActions isPending={isPending} isEdit={Boolean(product)} />
    </form>
  );
}
