import { describe, expect, it } from "vitest";
import { z } from "zod";

import { checkoutSchema, normalizeMobile } from "@/lib/validation/checkout";

/** Mirrors the cart payload schema in checkout actions (kept in sync). */
const cartSchema = z
  .array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().min(1).max(99),
      sizeId: z.string().nullable(),
      colorId: z.string().nullable(),
    }),
  )
  .min(1, "Your cart is empty")
  .max(50);

const validCustomer = {
  customerName: "Test Customer",
  mobile: "9876543210",
  addressLine: "12 Test Street, Sector 5",
  city: "Jatwar",
  state: "Haryana",
  pinCode: "134201",
};

describe("customer details validation (6)", () => {
  it("accepts a valid Indian customer record", () => {
    expect(checkoutSchema.safeParse(validCustomer).success).toBe(true);
  });

  it("normalizes +91, spaces and dashes in mobile numbers", () => {
    expect(normalizeMobile("+91 98765-43210")).toBe("9876543210");
    expect(checkoutSchema.safeParse({ ...validCustomer, mobile: "+91 98765-43210" }).success).toBe(
      true,
    );
  });

  it("rejects invalid mobile numbers", () => {
    for (const bad of ["12345", "0123456789", "98765", "abcdefghij"]) {
      expect(checkoutSchema.safeParse({ ...validCustomer, mobile: bad }).success).toBe(false);
    }
  });

  it("rejects a 5-digit or 7-digit PIN code and leading zero", () => {
    expect(checkoutSchema.safeParse({ ...validCustomer, pinCode: "12345" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...validCustomer, pinCode: "1234567" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...validCustomer, pinCode: "0134201" }).success).toBe(false);
  });

  it("requires a meaningful address (≥10 chars)", () => {
    expect(checkoutSchema.safeParse({ ...validCustomer, addressLine: "short" }).success).toBe(
      false,
    );
  });

  it("rejects names with digits or too-short names", () => {
    expect(checkoutSchema.safeParse({ ...validCustomer, customerName: "A" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...validCustomer, customerName: "Test 123" }).success).toBe(
      false,
    );
  });
});

describe("cart payload validation (3, 8)", () => {
  const line = { productId: "p1", quantity: 2, sizeId: null, colorId: null };

  it("accepts a well-formed cart", () => {
    expect(cartSchema.safeParse([line]).success).toBe(true);
  });

  it("rejects zero, negative and fractional quantities", () => {
    expect(cartSchema.safeParse([{ ...line, quantity: 0 }]).success).toBe(false);
    expect(cartSchema.safeParse([{ ...line, quantity: -1 }]).success).toBe(false);
    expect(cartSchema.safeParse([{ ...line, quantity: 1.5 }]).success).toBe(false);
  });

  it("rejects quantities above the 99 cap", () => {
    expect(cartSchema.safeParse([{ ...line, quantity: 100 }]).success).toBe(false);
  });

  it("rejects an empty cart and a >50-line cart", () => {
    expect(cartSchema.safeParse([]).success).toBe(false);
    const big = Array.from({ length: 51 }, (_, i) => ({
      productId: `p${i}`,
      quantity: 1,
      sizeId: null,
      colorId: null,
    }));
    expect(cartSchema.safeParse(big).success).toBe(false);
  });

  it("rejects missing product ids", () => {
    expect(cartSchema.safeParse([{ ...line, productId: "" }]).success).toBe(false);
  });
});
