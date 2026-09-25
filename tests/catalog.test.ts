import { describe, expect, it } from "vitest";

import {
  discountPercent,
  filterAndSort,
  filterProducts,
  findProductBySlug,
  isAvailable,
  parseSort,
  relatedProducts,
  sortProducts,
} from "@/lib/catalog";
import { formatPrice } from "@/lib/utils";
import { makeProduct, products } from "./fixtures/catalog";

describe("price formatting (integer paise)", () => {
  it("formats paise as INR with two decimals", () => {
    expect(formatPrice(120_000)).toBe("₹1,200.00");
    expect(formatPrice(89_900)).toBe("₹899.00");
    expect(formatPrice(1)).toBe("₹0.01");
  });
});

describe("discount calculation (1, 2)", () => {
  it("computes the percentage off the ORIGINAL price", () => {
    // 120000 of 150000 → exactly 20%
    expect(discountPercent(products[0]!)).toBe(20);
    // 130000 of 155000 → 16.12… → rounded 16
    expect(discountPercent(products[1]!)).toBe(16);
  });

  it("returns null when there is no reference price", () => {
    expect(discountPercent(products[2]!)).toBeNull();
  });

  it("returns null when the reference price is not strictly higher", () => {
    // Equal prices = no discount (DB CHECK also enforces discountPrice > price)
    expect(
      discountPercent(makeProduct({ id: "eq", price: 100_000, discountPrice: 100_000 })),
    ).toBeNull();
    // Reference price BELOW the selling price is corrupt data, never a discount
    expect(
      discountPercent(makeProduct({ id: "low", price: 100_000, discountPrice: 90_000 })),
    ).toBeNull();
  });
});

describe("product visibility (10)", () => {
  it("never shows inactive products in filtered results", () => {
    const visible = filterProducts(products, {
      query: "",
      categories: [],
      inStockOnly: false,
    });
    expect(visible.map((p) => p.id)).not.toContain("p5");
  });

  it("respects the in-stock filter; untracked stock counts as available", () => {
    const inStock = filterProducts(products, {
      query: "",
      categories: [],
      inStockOnly: true,
    });
    // p2 has stock 0 → excluded; p3 has stock null → included
    expect(inStock.map((p) => p.id)).not.toContain("p2");
    expect(inStock.map((p) => p.id)).toContain("p3");
  });

  it("derives availability from stock (8, part 1)", () => {
    expect(isAvailable(makeProduct({ id: "a", stock: null }))).toBe(true);
    expect(isAvailable(makeProduct({ id: "b", stock: 1 }))).toBe(true);
    expect(isAvailable(makeProduct({ id: "c", stock: 0 }))).toBe(false);
  });
});

describe("category filtering (11)", () => {
  it("filters by category slug", () => {
    const festive = filterProducts(products, {
      query: "",
      categories: ["festive-wear"],
      inStockOnly: false,
    });
    expect(festive.map((p) => p.id)).toEqual(["p2", "p4"]);
  });

  it("combines category + query + price band correctly", () => {
    const combined = filterAndSort(
      products,
      { query: "suit", categories: ["suit-material"], inStockOnly: false },
      "newest",
    );
    // newest first: p3 (Jan 4) before p1 (Jan 2)
    expect(combined.map((p) => p.id)).toEqual(["p3", "p1"]);
  });

  it("counts per category within the filtered set", async () => {
    const { countByCategory } = await import("@/lib/catalog");
    const counts = countByCategory(products, { query: "", categories: [], inStockOnly: false });
    expect(counts["suit-material"]).toBe(2);
    expect(counts["festive-wear"]).toBe(2);
  });
});

describe("slug handling (12)", () => {
  it("finds an active product by exact slug", () => {
    expect(findProductBySlug(products, "rosewood-pink-embroidered-suit-material")?.id).toBe("p1");
  });

  it("returns undefined for unknown or inactive slugs", () => {
    expect(findProductBySlug(products, "nope")).toBeUndefined();
    expect(findProductBySlug(products, "inactive-draft-product")).toBeUndefined();
  });

  it("slugifies names for URLs", async () => {
    const { slugify } = await import("@/lib/utils");
    expect(slugify("Women's Rosewood Pink Suit")).toBe("womens-rosewood-pink-suit");
    expect(slugify("  Festive & Premium Collection ")).toBe("festive-premium-collection");
    expect(slugify("---trimmed---")).toBe("trimmed");
  });
});

describe("related products", () => {
  it("excludes the product itself and inactive items, newest first, limited", () => {
    // From p1 (suit-material): same-category active items are p3 (Jan 4) and
    // p5 (inactive → excluded), so only p3 qualifies, newest first.
    const related = relatedProducts(products, products[0]!, 4);
    expect(related.map((p) => p.id)).toEqual(["p3"]);
  });
});

describe("sorting (stable, no mutation)", () => {
  it("sorts by price ascending/descending without mutating the input", () => {
    const input = [products[0]!, products[3]!, products[2]!];
    const asc = sortProducts(input, "price-asc");
    expect(asc.map((p) => p.price)).toEqual([89_900, 120_000, 320_000]);
    const desc = sortProducts(input, "price-desc");
    expect(desc.map((p) => p.price)).toEqual([320_000, 120_000, 89_900]);
    expect(input.map((p) => p.id)).toEqual(["p1", "p4", "p3"]); // untouched
  });

  it("parses only known sort values (falls back to newest)", () => {
    expect(parseSort("price-asc")).toBe("price-asc");
    expect(parseSort("DROP TABLE")).toBe("newest");
    expect(parseSort(null)).toBe("newest");
  });
});
