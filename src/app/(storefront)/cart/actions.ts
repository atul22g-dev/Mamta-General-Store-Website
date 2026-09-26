"use server";

import { getSupabasePublicClient } from "@/lib/supabase/public";

export interface CartLineRefresh {
  /** Current selling price in paise (server-side truth). */
  price: number;
  name: string;
  /** Current tracked stock; null = untracked/always available. */
  stock: number | null;
  active: boolean;
}

interface ProductRow {
  id: string;
  name: string;
  price: number;
  stock: number | null;
  active: boolean;
}

/**
 * Re-read current price/stock/availability for the cart's products so the
 * cart page shows what an order would ACTUALLY charge (place_order always
 * re-reads server-side prices at order time — this closes the gap between
 * the displayed total and the recorded one when prices changed after the
 * item was added). Public read only — the same anon client the catalog uses.
 */
export async function refreshCartLinesAction(
  productIds: string[],
): Promise<Record<string, CartLineRefresh>> {
  if (!Array.isArray(productIds) || productIds.length === 0 || productIds.length > 50) {
    return {};
  }
  const ids = productIds.filter((id) => typeof id === "string" && id.length > 0).slice(0, 50);
  if (ids.length === 0) return {};

  const { data, error } = await getSupabasePublicClient()
    .from("products")
    .select("id, name, price, stock, active")
    .in("id", ids);

  if (error || !data) return {};

  const out: Record<string, CartLineRefresh> = {};
  for (const row of data as ProductRow[]) {
    out[row.id] = {
      price: row.price,
      name: row.name,
      stock: row.stock,
      active: row.active,
    };
  }
  return out;
}
