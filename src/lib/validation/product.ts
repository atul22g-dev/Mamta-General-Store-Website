import { z } from "zod";

/**
 * Admin product form validation. Prices are entered in rupees (e.g. 1999.50)
 * and stored as integer paise — converted here so the DB never sees floats.
 * Shared by the create/update server action and the client form for
 * identical rules on both sides.
 */

/** "1999.5" | "₹1,999" | 1999.5 → 199950 paise; null for empty input. */
export function parseRupees(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).replace(/[₹,\s]/g, "");
  if (raw === "") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

const rupeesField = z.preprocess(
  parseRupees,
  z
    .number({ error: "Enter a valid amount" })
    .int("Amounts too precise")
    .positive("Must be greater than 0"),
);

export const productFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Name must be at least 3 characters")
      .max(120, "Name must be under 120 characters"),
    /** Blank → auto-generated from the name (preprocess). */
    slug: z.preprocess(
      (value) => (value == null || String(value).trim() === "" ? undefined : value),
      z
        .string()
        .trim()
        .min(3, "Slug must be at least 3 characters")
        .max(140, "Slug must be under 140 characters")
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only")
        .optional()
        .transform((value) => value ?? ""),
    ),
    categoryId: z.string().min(1, "Choose a category"),
    /** Optional merchant product code; unique when provided. */
    sku: z.preprocess(
      (value) => (value == null || String(value).trim() === "" ? undefined : value),
      z
        .string()
        .trim()
        .max(60, "SKU is too long")
        .optional()
        .transform((value) => value ?? null),
    ),
    description: z
      .string()
      .trim()
      .max(5000, "Description too long (max 5000 characters)")
      .optional()
      .or(z.literal("")),
    /** Entered/displayed in rupees. */
    price: rupeesField,
    discountPrice: z.preprocess(parseRupees, z.number().int().positive().nullable().optional()),
    /**
     * Inventory handling chosen in the admin form:
     * - `untracked` — always available (stock stored as NULL; checkout skips
     *   the stock decrement; matches every product created before the field
     *   existed)
     * - `out_of_stock` — temporarily unavailable (stock stored as 0)
     * - `quantity` — tracked count that decrements with each order
     */
    stockMode: z.enum(["untracked", "out_of_stock", "quantity"]).default("untracked"),
    stock: z.preprocess(
      (value) => {
        if (value == null || String(value).trim() === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      },
      z
        .number({ error: "Enter a valid quantity" })
        .int("Whole numbers only")
        .min(0, "Stock can't be negative")
        .max(999999, "Quantity is too large")
        .nullable(),
    ),
    /**
     * Optional when an image file is uploaded instead (the action requires
     * either a file or a URL). Still URL-validated when provided.
     */
    imageUrl: z.preprocess(
      (value) => (value == null || String(value).trim() === "" ? undefined : value),
      z
        .string()
        .trim()
        .url("Enter a valid image URL (https://…)")
        .max(1000, "URL too long")
        .optional(),
    ),
    active: z.boolean().default(false),
    featured: z.boolean().default(false),
    isNewArrival: z.boolean().default(false),
  })
  .refine((data) => data.discountPrice == null || data.discountPrice >= data.price, {
    error: "Original price can't be lower than the selling price",
    path: ["discountPrice"],
  })
  .refine((data) => data.stockMode !== "quantity" || data.stock !== null, {
    error: "Enter a stock quantity (or choose Out of stock)",
    path: ["stock"],
  });

export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormData = z.output<typeof productFormSchema>;

/** Convert validated form data into database-ready product values (no relations). */
export function toDatabaseValues(data: ProductFormData) {
  return {
    name: data.name,
    slug: data.slug,
    sku: data.sku,
    description: data.description ? data.description : null,
    price: data.price,
    discountPrice: data.discountPrice ?? null,
    // Inventory: untracked (NULL = always available), explicitly out of
    // stock (0), or a tracked quantity that decrements with each order.
    stock:
      data.stockMode === "untracked"
        ? null
        : data.stockMode === "out_of_stock"
          ? 0
          : (data.stock ?? 0),
    featured: data.featured,
    isNewArrival: data.isNewArrival,
    active: data.active,
    categoryId: data.categoryId,
  };
}

export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
