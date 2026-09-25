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
  .refine((data) => data.discountPrice == null || data.discountPrice > data.price, {
    error: "Original price must be higher than the selling price",
    path: ["discountPrice"],
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
    // Stock is not managed in the admin form: products are saved as untracked
    // (null = always available; checkout skips the stock decrement).
    stock: null,
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
