import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names with shadcn/ui conventions. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a price in minor units (paise) as INR, e.g. 199900 -> "₹1,999.00". */
export function formatPrice(minorUnits: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(minorUnits / 100);
}

/** Convert a display name to a URL-friendly slug, e.g. "Ladies' Suits" -> "ladies-suits". */
export function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
