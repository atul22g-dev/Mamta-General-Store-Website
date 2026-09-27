import { describe, expect, it, vi } from "vitest";

import { getShopProducts } from "@/lib/supabase/catalog";

/**
 * PostgREST-faithful fake client.
 *
 * The bug this file locks down: filtering on an EMBEDDED relation
 * (`.in("categories.slug", …)`) does not exclude non-matching parent rows —
 * PostgREST keeps every row and merely nulls the embed that did not match.
 * The app then fell back to an "Uncategorized" label for those rows and
 * showed other categories' products on a filtered page.
 *
 * The fake reproduces exactly those semantics: top-level column filters
 * (eq/in on "categoryId", "active", …) drop rows; embed filters
 * (`categories.slug`) keep the row but null the embed on mismatch.
 */

type Row = Record<string, unknown>;

const { fakeClient } = vi.hoisted(() => {
  const CATEGORIES: Row[] = [
    { id: "household", name: "HouseHold", slug: "household", active: true },
    { id: "suit-material", name: "Suit Material", slug: "suit-material", active: true },
    { id: "retired", name: "Retired Collection", slug: "retired", active: false },
  ];

  function productRow(id: string, categoryId: string, name: string, active = true): Row {
    return {
      id,
      name,
      slug: id,
      price: 100_000,
      active,
      categoryId,
      categories: CATEGORIES.find((c) => c.id === categoryId) ?? null,
      product_images: [],
      product_sizes: [],
      product_colors: [],
      createdAt: "2026-09-01T00:00:00.000Z",
    };
  }

  const PRODUCTS: Row[] = [
    productRow("plush-dog", "household", "Soft Plush Dog Stuffed Toy"),
    productRow("plush-turtle", "household", "Soft Plush Turtle Stuffed Toy"),
    productRow("suit-rosewood", "suit-material", "Rosewood Pink Embroidered Suit"),
    productRow("suit-wine", "suit-material", "Wine Maroon Embroidered Suit"),
    productRow("retired-item", "retired", "Discontinued Collection Item"),
    productRow("draft-item", "household", "Inactive Draft", false),
  ];

  function builder(table: string): Record<string, unknown> {
    let rows: Row[] =
      table === "products"
        ? [...PRODUCTS]
        : table === "categories"
          ? [...CATEGORIES]
          : [];
    const isEmbedFilter = (column: string) => column.includes(".");

    const chain: Record<string, unknown> = {
      select() {
        return chain;
      },
      eq(column: string, value: unknown) {
        if (isEmbedFilter(column)) {
          // Embed semantics: keep the row, null the embed on mismatch.
          const [, key] = column.split(".");
          rows = rows.map((row) => {
            const embed = row[key.split(" ")[0]!] as Row | null;
            return embed && embed[key] === value ? row : { ...row, [key.split(" ")[0]!]: null };
          });
        } else {
          rows = rows.filter((row) => row[column] === value);
        }
        return chain;
      },
      in(column: string, values: unknown[]) {
        if (isEmbedFilter(column)) {
          const [embedName, key] = column.split(".");
          rows = rows.map((row) => {
            const embed = row[embedName] as Row | null;
            return embed && values.includes(embed[key]!) ? row : { ...row, [embedName]: null };
          });
        } else {
          rows = rows.filter((row) => values.includes(row[column]));
        }
        return chain;
      },
      or() {
        throw new Error("unexpected .or() in category-filter code path");
      },
      order(column: string, options?: { ascending?: boolean; referencedTable?: string }) {
        if (options?.referencedTable) return chain; // relation ordering: no-op
        const dir = options?.ascending === false ? -1 : 1;
        rows = rows.slice().sort((a, b) => (a[column]! > b[column]! ? dir : -dir));
        return chain;
      },
      limit(count: number) {
        rows = rows.slice(0, count);
        return chain;
      },
    then(resolve: (value: { data: Row[]; error: null }) => void) {
      // supabase-js awaits resolve to a { data, error } envelope.
      return resolve({ data: rows, error: null });
    },
    };
    return chain;
  }

  return {
    fakeClient: {
      from: (table: string) => builder(table),
    } as never,
  };
});

vi.mock("@/lib/supabase/public", () => ({
  getSupabasePublicClient: () => fakeClient,
}));

describe("getShopProducts category filtering (embed-null regression)", () => {
  it("returns only the selected category's products, with intact embeds", async () => {
    const products = await getShopProducts({ categories: ["household"] });

    expect(products.map((p) => p.slug).sort()).toEqual(["plush-dog", "plush-turtle"]);
    for (const product of products) {
      expect(product.category.slug).toBe("household");
      expect(product.category.name).toBe("HouseHold");
    }
  });

  it("a different selection returns that category's products — never 'Uncategorized'", async () => {
    const suits = await getShopProducts({ categories: ["suit-material"] });

    expect(suits.map((p) => p.slug).sort()).toEqual(["suit-rosewood", "suit-wine"]);
    for (const product of suits) {
      expect(product.category.name).not.toBe("Uncategorized");
      expect(product.category.slug).toBe("suit-material");
    }
  });

  it("products of one category never leak into another category's results", async () => {
    const household = await getShopProducts({ categories: ["household"] });

    expect(household.some((p) => p.category.slug === "suit-material")).toBe(false);
    expect(household.some((p) => p.category.name === "Uncategorized")).toBe(false);
  });

  it("products in inactive categories are excluded", async () => {
    const products = await getShopProducts({ categories: ["retired"] });

    expect(products).toEqual([]);
  });

  it("an unknown category slug matches nothing", async () => {
    const products = await getShopProducts({ categories: ["does-not-exist"] });

    expect(products).toEqual([]);
  });

  it("no category filter still returns every active product", async () => {
    const products = await getShopProducts({});

    expect(products).toHaveLength(4); // draft-item (inactive) and retired-item (inactive category) stay out
    expect(products.every((p) => p.category.name !== "Uncategorized")).toBe(true);
  });
});
