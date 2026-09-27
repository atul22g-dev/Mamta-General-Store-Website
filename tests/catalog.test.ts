import { describe, expect, it } from "vitest";

import {
  buildRelatedList,
  discountPercent,
  filterAndSort,
  filterProducts,
  isAvailable,
  parseSort,
  rankSimilarProducts,
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
  it("slugifies names for URLs", async () => {
    const { slugify } = await import("@/lib/utils");
    expect(slugify("Women's Rosewood Pink Suit")).toBe("womens-rosewood-pink-suit");
    expect(slugify("  Festive & Premium Collection ")).toBe("festive-premium-collection");
    expect(slugify("---trimmed---")).toBe("trimmed");
  });
});

describe("similar products ranking", () => {
  const reference = products[0]!; // suit-material, ₹1,200, in stock, brand null

  it("prefers same-category products over others", () => {
    const ranked = rankSimilarProducts(reference, [products[3]!, products[2]!]);
    // p3 is suit-material, p4 is festive-wear
    expect(ranked[0]!.id).toBe("p3");
  });

  it("prefers in-stock over sold-out within a category", () => {
    const ranked = rankSimilarProducts(reference, [products[1]!, products[2]!]);
    // both suit-material; p2 is sold out (stock 0), p3 is available
    expect(ranked.map((p) => p.id)).toEqual(["p3", "p2"]);
  });

  it("prefers closer prices (log distance)", () => {
    const near = makeProduct({ id: "near", price: 130_000 });
    const far = makeProduct({ id: "far", price: 900_000 });
    const ranked = rankSimilarProducts(reference, [far, near]);
    expect(ranked[0]!.id).toBe("near");
  });

  it("prefers a shared brand over a different brand", () => {
    const ref = makeProduct({ id: "ref", brand: "Aarika" });
    const sameBrand = makeProduct({ id: "same", brand: "Aarika", price: 500_000 });
    const otherBrand = makeProduct({ id: "other", brand: "Meera", price: 110_000 });
    const ranked = rankSimilarProducts(ref, [otherBrand, sameBrand]);
    expect(ranked[0]!.id).toBe("same");
  });

  it("excludes the reference product and caps at the limit", () => {
    const list = buildRelatedList(reference, products, 2);
    expect(list).toHaveLength(2);
    expect(list.some((p) => p.id === reference.id)).toBe(false);
  });

  it("backfills from other categories so the grid still fills", () => {
    // Only two other suit-material products exist (p2 sold out, p3) — a limit
    // of 4 must reach into festive-wear for the remaining slots.
    const list = buildRelatedList(reference, products, 4);
    expect(list).toHaveLength(4);
    expect(list.slice(0, 2).map((p) => p.category.slug)).toEqual([
      "suit-material",
      "suit-material",
    ]);
    expect(list.slice(2).every((p) => p.category.slug === "festive-wear")).toBe(true);
  });

  it("does not mutate the candidates array", () => {
    const input = [products[3]!, products[2]!, products[1]!];
    const snapshot = input.map((p) => p.id);
    rankSimilarProducts(reference, input);
    expect(input.map((p) => p.id)).toEqual(snapshot);
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
