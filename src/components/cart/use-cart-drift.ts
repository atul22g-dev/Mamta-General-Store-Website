"use client";

import * as React from "react";

import { refreshCartLinesAction, type CartLineRefresh } from "@/app/(storefront)/cart/actions";

export interface CartDrift {
  /** Product id → current server truth for the fields that can drift. */
  current: Record<string, CartLineRefresh>;
  /** True while the first refresh is in flight. */
  refreshing: boolean;
}

/**
 * Keep the cart honest: localStorage lines hold add-time price/stock
 * snapshots, but the order charges CURRENT prices (place_order re-reads
 * server-side truth). This hook re-reads each line's product on mount and
 * whenever the cart's product set changes, exposing the server values so the
 * UI can show price drift and current availability instead of stale data.
 */
export function useCartDrift(items: Array<{ productId: string; unitPrice: number }>): CartDrift {
  const [current, setCurrent] = React.useState<Record<string, CartLineRefresh>>({});
  const [refreshing, setRefreshing] = React.useState(false);

  // Stable key of the product set — refetch only when membership changes,
  // not on every quantity tweak (price/stock don't depend on quantity).
  const productKey = React.useMemo(
    () =>
      items
        .map((item) => item.productId)
        .sort()
        .join(","),
    [items],
  );

  React.useEffect(() => {
    if (productKey === "") {
      setCurrent({});
      return;
    }
    let cancelled = false;
    setRefreshing(true);
    refreshCartLinesAction(productKey.split(","))
      .then((data) => {
        if (!cancelled) setCurrent(data);
      })
      .catch(() => {
        // Refresh is best-effort: on failure the cart keeps its snapshots —
        // the server still re-validates everything at order time.
        if (!cancelled) setCurrent({});
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productKey]);

  return { current, refreshing };
}
