"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";

/** Header cart button with a live item-count badge. */
export function CartButton() {
  const { count, isReady } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={`Shopping cart${count > 0 ? `, ${count} item${count === 1 ? "" : "s"}` : ""}`}
      className="relative inline-flex size-9 items-center justify-center rounded-md transition-colors hover:bg-accent"
    >
      <ShoppingBag className="size-4.5" aria-hidden="true" />
      {isReady && count > 0 && (
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
