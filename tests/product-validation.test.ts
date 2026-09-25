import { describe, expect, it } from "vitest";

import { productFormSchema, slugifyName, toDatabaseValues } from "@/lib/validation/product";

const base = {
  name: "Rosewood Pink Suit Material",
  categoryId: "cat-1",
  price: "1,199.99",
};

describe("rupees → paise conversion (1)", () => {
  it("converts display strings to integer paise", () => {
    const result = productFormSchema.parse({ ...base, price: "₹1,999.50" });
    expect(result.price).toBe(199_950); // never a float in the DB
  });

  it("handles commas, currency signs and plain numbers", () => {
    expect(productFormSchema.parse({ ...base, price: "2,499" }).price).toBe(249_900);
    expect(productFormSchema.parse({ ...base, price: "999" }).price).toBe(99_900);
  });

  it("rejects invalid amounts", () => {
    const result = productFormSchema.safeParse({ ...base, price: "abc" });
    expect(result.success).toBe(false);
    const zero = productFormSchema.safeParse({ ...base, price: "0" });
    expect(zero.success).toBe(false); // price must be > 0
  });
});

describe("discount constraint (2)", () => {
  it("accepts a reference price strictly above the selling price", () => {
    const ok = productFormSchema.safeParse({ ...base, price: "1200", discountPrice: "1500" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.discountPrice).toBe(150_000);
  });

  it("rejects a reference price equal or below the selling price", () => {
    expect(
      productFormSchema.safeParse({ ...base, price: "1200", discountPrice: "1200" }).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({ ...base, price: "1200", discountPrice: "1000" }).success,
    ).toBe(false);
  });

  it("allows an empty reference price", () => {
    const ok = productFormSchema.safeParse({ ...base, discountPrice: "" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.discountPrice).toBeNull();
  });
});

describe("product name/field validation (5)", () => {
  it("rejects too-short names and missing categories", () => {
    expect(productFormSchema.safeParse({ ...base, name: "ab" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...base, categoryId: "" }).success).toBe(false);
  });

  it("caps field lengths", () => {
    expect(productFormSchema.safeParse({ ...base, name: "x".repeat(121) }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...base, sku: "s".repeat(61) }).success).toBe(false);
  });
});

describe("slug handling (12)", () => {
  it("auto-generates a slug from the name when blank", () => {
    const data = productFormSchema.parse({ ...base, slug: "" });
    expect(data.slug).toBe(""); // the action then slugifies the name
    expect(slugifyName(data.name)).toBe("rosewood-pink-suit-material");
  });

  it("rejects malformed slugs", () => {
    expect(productFormSchema.safeParse({ ...base, slug: "Not A Slug" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...base, slug: "double--hyphen" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...base, slug: "ok-slug-123" }).success).toBe(true);
  });

  it("maps validated data to database values (no floats, no partial rows)", () => {
    const data = productFormSchema.parse({
      ...base,
      price: "1200",
      discountPrice: "1500",
      description: "  Embroidered fabric  ",
    });
    const values = toDatabaseValues(data);
    expect(values).toMatchObject({
      price: 120_000,
      discountPrice: 150_000,
      description: "Embroidered fabric",
      stock: null, // stockMode defaults to untracked
    });
  });

  it("stock modes map to the right database values (9: stock validation)", () => {
    // Default (no field submitted): untracked → NULL, always available.
    expect(toDatabaseValues(productFormSchema.parse(base)).stock).toBeNull();
    // Explicit out-of-stock → 0 (visible, unpurchasable).
    expect(
      toDatabaseValues(productFormSchema.parse({ ...base, stockMode: "out_of_stock" })).stock,
    ).toBe(0);
    // Tracked quantity → stored as the given whole number.
    expect(
      toDatabaseValues(productFormSchema.parse({ ...base, stockMode: "quantity", stock: "12" }))
        .stock,
    ).toBe(12);
  });

  it("rejects invalid stock input", () => {
    // Tracked mode requires a quantity.
    expect(productFormSchema.safeParse({ ...base, stockMode: "quantity", stock: "" }).success).toBe(
      false,
    );
    // Negative and fractional quantities are rejected.
    expect(
      productFormSchema.safeParse({ ...base, stockMode: "quantity", stock: "-3" }).success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({ ...base, stockMode: "quantity", stock: "1.5" }).success,
    ).toBe(false);
    // Unknown modes are rejected.
    expect(productFormSchema.safeParse({ ...base, stockMode: "infinite" }).success).toBe(false);
  });
});
