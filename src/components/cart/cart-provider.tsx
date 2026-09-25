"use client";

import * as React from "react";

import { MAX_CART_QUANTITY } from "@/lib/constants";

import { createStore } from "./cart-store";

/**
 * Client-side shopping cart.
 *
 * - Persisted to localStorage per browser (guest cart; merges with accounts later).
 * - Stores the data needed to display a line AND to place an order:
 *   price/stock snapshots come from the product data at add-time and are
 *   re-validated server-side at checkout.
 * - A line is keyed by product + size + color so the same suit in two sizes
 *   is two lines.
 * - Implemented as an external store read via useSyncExternalStore, so
 *   SSR renders the empty cart and hydration causes no mismatch.
 */

export interface CartItem {
  /** Composite key: productId:sizeId:colorId. */
  id: string;
  productId: string;
  slug: string;
  name: string;
  /** Selling price per unit in paise (at add time; re-validated at checkout). */
  unitPrice: number;
  imageUrl: string | null;
  sizeId: string | null;
  sizeLabel: string | null;
  colorId: string | null;
  colorName: string | null;
  quantity: number;
  /** Stock at add time; null = not tracked. Used for client-side clamping. */
  maxQuantity: number | null;
}

const cartStore = createStore<CartItem[]>({
  storageKey: "mgs_cart_v1",
  validate: (raw): CartItem[] => {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry) => {
      const item = entry as Partial<CartItem>;
      if (
        typeof item.id !== "string" ||
        typeof item.productId !== "string" ||
        typeof item.name !== "string" ||
        typeof item.unitPrice !== "number" ||
        item.unitPrice <= 0
      ) {
        return [];
      }
      const quantity = sanitizeQuantity(item.quantity, item.maxQuantity ?? null);
      return [{ ...(item as CartItem), quantity }];
    });
  },
});

function makeItemId(productId: string, sizeId: string | null, colorId: string | null): string {
  return [productId, sizeId ?? "-", colorId ?? "-"].join(":");
}

/**
 * Coerce any quantity (typed input, tampered localStorage) into a usable
 * line quantity: a whole number in 1..min(max, MAX_CART_QUANTITY).
 */
function sanitizeQuantity(quantity: unknown, max: number | null): number {
  const parsed = Number(quantity);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  const capped = Math.min(parsed, MAX_CART_QUANTITY, max ?? Infinity);
  return Math.floor(capped);
}

export interface CartContextValue {
  items: CartItem[];
  /** Total item count (sum of quantities). */
  count: number;
  /** Sum of unitPrice × quantity, in paise. */
  subtotal: number;
  isReady: boolean;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = React.createContext<CartContextValue | null>(null);

/**
 * Stable server snapshot — must be a module-level constant so the same array
 * identity is returned on every SSR call (React caches it; a fresh `[]` per
 * call would log "getServerSnapshot should be cached" and can loop).
 */
const EMPTY_ITEMS: CartItem[] = [];

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = React.useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    () => EMPTY_ITEMS, // server snapshot: empty cart, no hydration mismatch
  );

  const addItem = React.useCallback((item: Omit<CartItem, "id">) => {
    cartStore.update((current) => {
      const id = makeItemId(item.productId, item.sizeId, item.colorId);
      const existing = current.find((line) => line.id === id);

      if (existing) {
        return current.map((line) =>
          line.id === id
            ? {
                ...line,
                // Merge = SUM of the quantities (adding twice the same item
                // doubles the line), then clamped: the incoming quantity can
                // also come from a product whose stored maxQuantity is stale
                // (restocked down).
                quantity: sanitizeQuantity(line.quantity + item.quantity, line.maxQuantity),
              }
            : line,
        );
      }

      return [
        ...current,
        { ...item, quantity: sanitizeQuantity(item.quantity, item.maxQuantity ?? null), id },
      ];
    });
  }, []);

  const removeItem = React.useCallback((id: string) => {
    cartStore.update((current) => current.filter((line) => line.id !== id));
  }, []);

  const setQuantity = React.useCallback((id: string, quantity: number) => {
    cartStore.update((current) =>
      current.flatMap((line) => {
        if (line.id !== id) return [line];
        // Zero or negative (non-finite too) removes the line — the stepper's
        // decrease-at-one path; sanitizeQuantity alone would floor to 1.
        const parsed = Number(quantity);
        if (!Number.isFinite(parsed) || parsed < 1) return [];
        const next = sanitizeQuantity(parsed, line.maxQuantity);
        return [{ ...line, quantity: next }];
      }),
    );
  }, []);

  const clear = React.useCallback(() => cartStore.update(() => []), []);

  const value = React.useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

    return { items, count, subtotal, isReady: true, addItem, removeItem, setQuantity, clear };
  }, [items, addItem, removeItem, setQuantity, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = React.useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return context;
}
