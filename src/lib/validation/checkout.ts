import { z } from "zod";

/**
 * Checkout validation for Indian retail customers.
 * Shared by the client form and the placeOrder server action.
 */

/** Indian mobile numbers: 10 digits starting 6-9; tolerant of +91/spaces. */
export function normalizeMobile(value: unknown): string {
  return String(value ?? "")
    .replace(/^\+91/, "")
    .replace(/[\s-]/g, "");
}

export const checkoutSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(3, "Enter your full name")
    .max(80, "Name is too long")
    .regex(/^[a-zA-Z][a-zA-Z\s.'-]*$/, "Letters, spaces, apostrophes and hyphens only"),
  mobile: z.preprocess(
    normalizeMobile,
    z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  ),
  addressLine: z
    .string()
    .trim()
    .min(10, "Enter your complete address (house, street, area)")
    .max(200, "Address is too long"),
  city: z.string().trim().min(2, "Enter your city").max(60, "City name is too long"),
  state: z.string().trim().min(2, "Enter your state").max(60, "State name is too long"),
  pinCode: z.preprocess(
    (value) => String(value ?? "").trim(),
    z.string().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
  ),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;
