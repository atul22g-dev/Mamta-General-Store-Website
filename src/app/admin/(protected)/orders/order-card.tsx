"use client";

import { PackageSearch, Trash2 } from "lucide-react";

import type { AdminOrder, OrderStatus } from "@/lib/supabase/admin-orders";
import { formatPrice } from "@/lib/utils";
import { deleteOrderAction, updateOrderStatusAction } from "@/app/admin/orders/order-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PACKED: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-violet-100 text-violet-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-destructive/10 text-destructive",
};

/**
 * One order: header, line items, status management and permanent deletion.
 * A Client Component because the delete needs a JavaScript confirm dialog —
 * interactions can't be passed down from a Server Component. Actions come
 * from the client-safe action module; statuses are plain data.
 */
export function OrderCard({
  order,
  statuses,
}: {
  order: AdminOrder;
  statuses: readonly OrderStatus[];
}) {
  return (
    <li className="bg-card rounded-xl border p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-medium">
            {order.orderNumber}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                STATUS_STYLES[order.status],
              )}
            >
              {order.status}
            </span>
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {order.customerName}
            {order.customerPhone && <> · {order.customerPhone}</>}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {order.shippingLine1}, {order.shippingCity}, {order.shippingState}{" "}
            {order.shippingPostalCode}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{formatPrice(order.total)}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {order.itemCount} item{order.itemCount === 1 ? "" : "s"} ·{" "}
            {order.createdAt.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Items with product images */}
      <ul className="border-t mt-4 pt-3 text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-1.5">
            {item.productImage ? (
              /* eslint-disable-next-line @next/next/no-img-element -- product covers come from the project's own Supabase Storage host */
              <img
                src={item.productImage}
                alt=""
                loading="lazy"
                className="size-12 shrink-0 rounded-lg border object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-lg border"
              >
                <PackageSearch className="size-5" />
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">
              {item.productName} × {item.quantity}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {formatPrice(item.lineTotal)}
            </span>
          </li>
        ))}
      </ul>

      {/* Status management */}
      <form action={updateOrderStatusAction} className="border-t mt-4 flex items-center gap-3 pt-4">
        <input type="hidden" name="id" value={order.id} />
        <label className="text-muted-foreground text-xs" htmlFor={`status-${order.id}`}>
          Update status
        </label>
        <select
          id={`status-${order.id}`}
          name="status"
          defaultValue={order.status}
          className="h-9 rounded-lg border bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="outline">
          Save
        </Button>
      </form>

      {/* Permanent deletion — confirm-gated; for test/duplicate orders only */}
      <form
        action={deleteOrderAction}
        className="border-t mt-3 flex items-center justify-between gap-3 pt-3"
        onSubmit={(event) => {
          if (
            !window.confirm(`Permanently delete order ${order.orderNumber}? This cannot be undone.`)
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={order.id} />
        <p className="text-muted-foreground text-xs">
          For test or duplicate orders only — real orders should be cancelled instead.
        </p>
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Delete order ${order.orderNumber}`}
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Delete
        </Button>
      </form>
    </li>
  );
}
