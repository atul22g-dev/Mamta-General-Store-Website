"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2, Loader2, Lock, Phone, ShieldCheck } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { placeOrderAction, type PlaceOrderState } from "@/app/(storefront)/checkout/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";

const initialState: PlaceOrderState = {};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="text-destructive mt-1.5 text-xs">
      {errors[0]}
    </p>
  );
}

const invalid = (errors?: string[]) => (errors?.length ? { "aria-invalid": true } : {});

/**
 * Cash-on-delivery checkout: contact + shipping form beside a live order
 * summary. Prices shown come from the local cart; the server re-validates
 * everything (prices, stock) before creating the order.
 */
export function CheckoutForm() {
  const { items, subtotal, count, isReady, clear } = useCart();

  // After a successful order the cart must be cleared. Clearing inside the
  // action wrapper (an event-handler-like path) is effect-free; the wrapper
  // is recreated only when `clear` changes (stable in the provider).
  const checkoutAction = React.useCallback(
    async (prev: PlaceOrderState, formData: FormData): Promise<PlaceOrderState> => {
      const result = await placeOrderAction(prev, formData);
      if (result.orderNumber) clear();
      return result;
    },
    [clear],
  );

  const [state, formAction, isPending] = useActionState(checkoutAction, initialState);
  const placedOrderNumber = state.orderNumber ?? null;

  const shipping = subtotal >= 99900 ? 0 : 9900;
  const total = subtotal + shipping;

  if (placedOrderNumber) {
    return (
      <div className="mx-auto max-w-md py-10 text-center sm:py-16">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 aria-hidden="true" className="size-8" />
        </span>
        <h2 className="font-display mt-6 text-3xl font-semibold tracking-tight">Order placed!</h2>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Thank you for your order. We&apos;ll call you on your mobile number to confirm the details
          and payment — cash, UPI or bank transfer.
        </p>
        <p className="mt-6 rounded-xl border bg-card px-4 py-3 text-sm shadow-soft">
          Order number: <span className="font-mono font-semibold">{placedOrderNumber}</span>
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/shop">Continue shopping</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md py-10 text-center sm:py-16">
        <h2 className="font-display text-2xl font-semibold">Nothing to check out</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Your cart is empty — add something lovely first.
        </p>
        <Button asChild className="mt-6">
          <Link href="/shop">Browse the shop</Link>
        </Button>
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};

  /** Only ids + quantities travel to the server; prices are re-read there. */
  const cartPayload = JSON.stringify(
    items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      sizeId: item.sizeId,
      colorId: item.colorId,
    })),
  );

  return (
    <form action={formAction} className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <input type="hidden" name="cart" value={cartPayload} />
      {/* Contact + shipping */}
      <div className="space-y-5">
        {state.error && !Object.keys(errors).length && (
          <div
            role="alert"
            className="text-destructive bg-destructive/10 rounded-lg px-4 py-3 text-sm"
          >
            {state.error}
          </div>
        )}

        <fieldset className="space-y-5" disabled={isPending}>
          <legend className="text-sm font-semibold tracking-wide uppercase">Contact details</legend>
          <div className="space-y-2">
            <Label htmlFor="customerName">Full name *</Label>
            <Input
              id="customerName"
              name="customerName"
              autoComplete="name"
              placeholder="Priya Sharma"
              required
              {...invalid(errors.customerName)}
            />
            <FieldError errors={errors.customerName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile number *</Label>
            <Input
              id="mobile"
              name="mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="98765 43210"
              required
              {...invalid(errors.mobile)}
            />
            <p className="text-muted-foreground text-xs">
              We&apos;ll call to confirm before dispatch.
            </p>
            <FieldError errors={errors.mobile} />
          </div>
        </fieldset>

        <fieldset className="space-y-5" disabled={isPending}>
          <legend className="text-sm font-semibold tracking-wide uppercase">
            Shipping address
          </legend>
          <div className="space-y-2">
            <Label htmlFor="addressLine">Address *</Label>
            <Textarea
              id="addressLine"
              name="addressLine"
              rows={2}
              autoComplete="street-address"
              placeholder="House no., street, area / landmark"
              required
              {...invalid(errors.addressLine)}
            />
            <FieldError errors={errors.addressLine} />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                name="city"
                autoComplete="address-level2"
                placeholder="Ambala"
                required
                {...invalid(errors.city)}
              />
              <FieldError errors={errors.city} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                name="state"
                autoComplete="address-level1"
                placeholder="Haryana"
                required
                {...invalid(errors.state)}
              />
              <FieldError errors={errors.state} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pinCode">PIN code *</Label>
              <Input
                id="pinCode"
                name="pinCode"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="134003"
                maxLength={6}
                required
                {...invalid(errors.pinCode)}
              />
              <FieldError errors={errors.pinCode} />
            </div>
          </div>
        </fieldset>

        <div className="bg-card flex items-start gap-3 rounded-xl border p-4">
          <Phone aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Pay on order confirmation</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              We&apos;ll call to confirm your order and share payment options — cash, UPI or bank
              transfer, whichever is easiest for you.
            </p>
          </div>
        </div>
      </div>

      {/* Order summary */}
      <aside className="bg-card h-fit rounded-2xl border p-6 shadow-soft lg:sticky lg:top-24">
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          Order summary ({count} item{count === 1 ? "" : "s"})
        </h2>
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.name}</span>
                <span className="text-muted-foreground text-xs">
                  {[item.sizeLabel, item.colorName].filter(Boolean).join(" · ") || "Standard"}
                  {" × "}
                  {item.quantity}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">
                {formatPrice(item.unitPrice * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-5 space-y-2.5 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd className="tabular-nums">{shipping === 0 ? "Free" : formatPrice(shipping)}</dd>
          </div>
          <div className="flex justify-between border-t pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPrice(total)}</dd>
          </div>
        </dl>

        <Button type="submit" size="lg" className="mt-6 w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Placing order…
            </>
          ) : (
            <>
              <Lock aria-hidden="true" className="size-4" />
              Place order
            </>
          )}
        </Button>
        <p className="text-muted-foreground mt-4 flex items-center justify-center gap-1.5 text-center text-xs">
          <ShieldCheck aria-hidden="true" className="size-3.5" />
          Free shipping on orders over ₹999 · Easy returns
        </p>
      </aside>
    </form>
  );
}
