"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { useCartDrift } from "@/components/cart/use-cart-drift";
import { SafeImage } from "@/components/product/safe-image";
import { Button } from "@/components/ui/button";
import { ImageArea } from "@/components/ui/image-area";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";

/**
 * Full cart page: line items with quantity steppers and removal, live
 * subtotal/total, and per-line out-of-stock handling. Prices and stock are
 * refreshed from the server on load (cart lines hold add-time snapshots),
 * so the totals shown here match what an order would actually charge.
 */
export function CartView() {
  const { items, count, isReady, setQuantity, removeItem, clear } = useCart();
  const { current } = useCartDrift(items);

  // Server truth per line, falling back to the add-time snapshot while the
  // refresh is in flight (or if it fails — the server re-validates at order
  // time regardless).
  const lines = items.map((item) => {
    const live = current[item.productId] ?? null;
    const livePrice = live?.price ?? item.unitPrice;
    const liveStock = live ? live.stock : item.maxQuantity;
    /** Product deactivated (hidden from the store) since it was added. */
    const inactive = live != null && !live.active;
    const soldOut = inactive || (liveStock !== null && liveStock < 1);
    const overStock = !soldOut && liveStock !== null && item.quantity > liveStock;
    return {
      item,
      /** Price an order would actually charge. */
      livePrice,
      priceChanged: live != null && live.price !== item.unitPrice,
      inactive,
      soldOut,
      overStock,
    };
  });
  const effectiveSubtotal = lines.reduce(
    (sum, line) => sum + line.livePrice * line.item.quantity,
    0,
  );
  const hasStockIssues = lines.some((line) => line.soldOut || line.overStock);

  if (!isReady) {
    return (
      <div className="space-y-4">
        {[0, 1].map((index) => (
          <div key={index} className="flex gap-4">
            <Skeleton className="aspect-4/5 w-24 shrink-0 rounded-xl sm:w-28" />
            <div className="flex-1 space-y-3 py-1">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center sm:py-20">
        <span className="bg-accent text-accent-foreground flex size-14 items-center justify-center rounded-full">
          <ShoppingBag aria-hidden="true" className="size-6" />
        </span>
        <h2 className="font-display mt-5 text-2xl font-semibold">Your cart is empty</h2>
        <p className="text-muted-foreground mt-2 max-w-xs text-sm">
          Beautiful suit materials are waiting. Browse the collection and find your next favorite.
        </p>
        <Button asChild className="mt-6">
          <Link href="/shop">
            Shop now
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      {/* Lines — min-w-0 lets the grid track shrink below the truncated
          product-name width instead of overflowing the viewport. */}
      <section className="min-w-0" aria-label="Cart items">
        <ul className="divide-y border-y">
          {lines.map(({ item, livePrice, priceChanged, soldOut, overStock, inactive }) => {
            return (
              <li key={item.id} className="flex gap-3 py-5 sm:gap-4">
                <Link href={`/products/${item.slug}`} className="shrink-0" aria-label={item.name}>
                  <ImageArea ratio="4/5" className="w-20 sm:w-24 lg:w-28" placeholder={false}>
                    {item.imageUrl ? (
                      <SafeImage
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        sizes="112px"
                        className="absolute inset-0 size-full object-cover"
                      />
                    ) : null}
                  </ImageArea>
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/products/${item.slug}`}
                        className="block truncate text-sm font-medium transition-colors hover:opacity-80 sm:text-base"
                      >
                        {item.name}
                      </Link>
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {[item.sizeLabel, item.colorName].filter(Boolean).join(" · ") || "Standard"}
                        {item.quantity > 1 && ` · ${formatPrice(livePrice)} each`}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${item.name} from cart`}
                      onClick={() => removeItem(item.id)}
                      className="text-muted-foreground hover:bg-accent/60 hover:text-destructive focus-visible:ring-ring/50 inline-flex size-10 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-[3px] focus-visible:outline-none md:size-9"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                    {/* Quantity stepper — 40px+ touch targets on mobile */}
                    <div className="flex items-center rounded-lg border">
                      <button
                        type="button"
                        aria-label={
                          item.quantity === 1
                            ? `Remove ${item.name}`
                            : `Decrease quantity of ${item.name}`
                        }
                        onClick={() =>
                          item.quantity === 1
                            ? removeItem(item.id)
                            : setQuantity(item.id, item.quantity - 1)
                        }
                        className="focus-visible:ring-ring/50 flex size-10 items-center justify-center rounded-l-lg transition-colors hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-40 md:size-9"
                        disabled={soldOut}
                      >
                        <Minus aria-hidden="true" className="size-4" />
                      </button>
                      <span
                        aria-live="polite"
                        aria-label={`Quantity of ${item.name}`}
                        className="w-10 text-center text-sm font-semibold tabular-nums"
                      >
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${item.name}`}
                        onClick={() => setQuantity(item.id, item.quantity + 1)}
                        className="focus-visible:ring-ring/50 flex size-10 items-center justify-center rounded-r-lg transition-colors hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-40 md:size-9"
                        disabled={
                          soldOut ||
                          (current[item.productId]?.stock !== null &&
                            current[item.productId]?.stock !== undefined &&
                            item.quantity >= (current[item.productId]?.stock ?? Infinity))
                        }
                      >
                        <Plus aria-hidden="true" className="size-4" />
                      </button>
                    </div>

                    <p className="text-sm font-semibold tabular-nums sm:text-base">
                      {priceChanged && (
                        <s className="text-muted-foreground mr-1.5 text-xs font-normal">
                          {formatPrice(item.unitPrice * item.quantity)}
                        </s>
                      )}
                      {formatPrice(livePrice * item.quantity)}
                    </p>
                  </div>

                  {inactive && (
                    <p role="status" className="text-destructive mt-2 text-xs">
                      No longer available — remove this item to continue.
                    </p>
                  )}
                  {!inactive && soldOut && (
                    <p role="status" className="text-destructive mt-2 text-xs">
                      Out of stock — remove this item to continue.
                    </p>
                  )}
                  {overStock && (
                    <p role="status" className="mt-2 text-xs text-amber-600">
                      Only {current[item.productId]?.stock} left — quantity will be reduced at
                      checkout.
                    </p>
                  )}
                  {priceChanged && !soldOut && (
                    <p role="status" className="text-muted-foreground mt-2 text-xs">
                      Price updated since you added this — totals reflect the current price.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/shop">← Continue shopping</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear cart
          </Button>
        </div>
      </section>

      {/* Summary */}
      <aside className="bg-card h-fit min-w-0 rounded-2xl border p-6 shadow-soft lg:sticky lg:top-24">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Order summary</h2>
        <dl className="mt-4 space-y-2.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              Subtotal ({count} item{count === 1 ? "" : "s"})
            </dt>
            <dd className="font-medium tabular-nums">{formatPrice(effectiveSubtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd className="text-muted-foreground">Calculated at checkout</dd>
          </div>
          <div className="text-base font-semibold">
            <div className="flex justify-between border-t pt-3">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPrice(effectiveSubtotal)}</dd>
            </div>
          </div>
        </dl>

        <Button
          size="lg"
          className="hidden w-full lg:flex"
          asChild={false}
          disabled={hasStockIssues}
        >
          <Link href="/checkout" className="contents">
            Proceed to checkout
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
        {hasStockIssues && (
          <p role="status" className="text-muted-foreground mt-3 text-center text-xs">
            Resolve out-of-stock items to continue.
          </p>
        )}
        <p className="text-muted-foreground mt-4 hidden text-center text-xs lg:block">
          Easy ordering by phone or WhatsApp · Easy returns
        </p>
      </aside>

      {/* Sticky mobile checkout bar — subtotal + CTA always reachable while
          scrolling the item list. The desktop CTA lives in the sticky aside. */}
      <div className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] uppercase">Subtotal</p>
            <p className="text-base font-semibold tabular-nums">{formatPrice(effectiveSubtotal)}</p>
          </div>
          <Button
            className="ml-auto h-11 flex-1 sm:flex-none sm:px-8"
            asChild
            disabled={hasStockIssues}
          >
            <Link href="/checkout">
              Checkout
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </div>
        {hasStockIssues && (
          <p role="status" className="text-muted-foreground mt-2 text-center text-xs">
            Resolve out-of-stock items to continue.
          </p>
        )}
      </div>
    </div>
  );
}
