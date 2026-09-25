import type { Product } from "@/types/product";
import type { CategoryRef } from "@/types/category";

/**
 * Catalog fixtures — realistic paise values mirroring the live schema
 * (integer minor units; discountPrice = ORIGINAL/reference price, which must
 * be strictly higher than price when a discount exists).
 */

export const suitCategory: CategoryRef = {
  id: "cat-suit",
  name: "Suit Material",
  slug: "suit-material",
};

export const festiveCategory: CategoryRef = {
  id: "cat-festive",
  name: "Festive Wear",
  slug: "festive-wear",
};

/** Minimal product factory — every field explicit, no hidden defaults. */
export function makeProduct(overrides: Partial<Product> & { id: string }): Product {
  return {
    name: `Test Product ${overrides.id}`,
    slug: `test-product-${overrides.id}`,
    category: suitCategory,
    description: null,
    price: 100_000,
    discountPrice: null,
    images: [],
    sizes: [],
    colors: [],
    stock: null,
    sku: null,
    brand: null,
    featured: false,
    isNewArrival: false,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export const products: Product[] = [
  makeProduct({
    id: "p1",
    name: "Rosewood Pink Embroidered Suit Material with Dupatta",
    slug: "rosewood-pink-embroidered-suit-material",
    price: 120_000, // ₹1,200
    discountPrice: 150_000, // ₹1,500 original → 20% off
    stock: 5,
    createdAt: "2026-01-02T00:00:00.000Z",
  }),
  makeProduct({
    id: "p2",
    name: "Wine Maroon Embroidered Suit Material with Dupatta",
    slug: "wine-maroon-embroidered-suit-material",
    category: festiveCategory,
    price: 130_000, // ₹1,300
    discountPrice: 155_000, // ₹1,550 original → 16% off
    stock: 0, // sold out
    featured: true,
    createdAt: "2026-01-03T00:00:00.000Z",
  }),
  makeProduct({
    id: "p3",
    name: "Everyday Cotton Suit Material",
    slug: "everyday-cotton-suit-material",
    price: 89_900, // ₹899 — no discount
    stock: null, // untracked = always available
    createdAt: "2026-01-04T00:00:00.000Z",
  }),
  makeProduct({
    id: "p4",
    name: "Premium Festive Silk Material",
    slug: "premium-festive-silk-material",
    category: festiveCategory,
    price: 320_000, // ₹3,200
    stock: 2,
    isNewArrival: true,
    createdAt: "2026-01-05T00:00:00.000Z",
  }),
  makeProduct({
    id: "p5",
    name: "Inactive Draft Product",
    slug: "inactive-draft-product",
    price: 50_000,
    active: false, // must never surface on the storefront
    createdAt: "2026-01-06T00:00:00.000Z",
  }),
];
