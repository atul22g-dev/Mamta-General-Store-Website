import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, Search } from "lucide-react";

import { listAdminOrders, ORDER_STATUSES, type OrderStatus } from "@/lib/supabase/admin-orders";
import { formatPrice } from "@/lib/utils";
import { updateOrderStatusAction } from "@/app/admin/orders/actions";
import { DatabaseErrorState, EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PACKED: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-violet-100 text-violet-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-destructive/10 text-destructive",
};

interface OrdersPageProps {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}

/** Build a filter link preserving the other parameters. */
function filterHref(status: string, q?: string, page?: string): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (q) params.set("q", q);
  if (page && page !== "1") params.set("page", page);
  const qs = params.toString();
  return `/admin/orders${qs ? `?${qs}` : ""}`;
}

/** Admin orders: searchable, filterable list with per-order status management. */
export default async function AdminOrdersPage({ searchParams }: OrdersPageProps) {
  const { status: statusParam = "all", q = "", page: pageParam = "1" } = await searchParams;
  const status = (ORDER_STATUSES as string[]).includes(statusParam)
    ? (statusParam as OrderStatus)
    : "all";
  const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);
  const searchQuery = q.trim().slice(0, 100);

  let result: Awaited<ReturnType<typeof listAdminOrders>> | null = null;
  let failed = false;
  try {
    result = await listAdminOrders({ status, query: searchQuery, page, pageSize: 20 });
  } catch {
    failed = true;
  }

  const totalPages = failed || !result ? 1 : Math.max(1, Math.ceil(result.total / 20));

  return (
    <Container className="py-8">
      <PageHeader
        title="Orders"
        description="Review incoming orders and update fulfilment status."
      />

      {/* Search + status filter */}
      <div className="mb-6 flex flex-col gap-3">
        <form role="search" action="/admin/orders" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search by order number, customer, phone, city or PIN code"
            aria-label="Search orders"
            className="h-10 w-full max-w-md rounded-lg border bg-background px-3.5 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <Button type="submit" size="icon" aria-label="Search">
            <Search aria-hidden="true" className="size-4" />
          </Button>
          {searchQuery && (
            <Button type="button" variant="ghost" size="icon" asChild aria-label="Clear search">
              <Link href={filterHref(status)}>
                <span aria-hidden="true">×</span>
              </Link>
            </Button>
          )}
        </form>

        <div className="flex flex-wrap gap-2">
          {(["all", ...ORDER_STATUSES] as const).map((value) => (
            <Link
              key={value}
              href={filterHref(value, searchQuery)}
              aria-current={status === value ? "page" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                status === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-accent/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "all" ? "All" : value.charAt(0) + value.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>
      </div>

      {failed ? (
        <div className="bg-card rounded-xl border shadow-soft">
          <DatabaseErrorState />
        </div>
      ) : !result || result.rows.length === 0 ? (
        <div className="bg-card rounded-xl border shadow-soft">
          <EmptyState
            icon={PackageSearch}
            message={
              searchQuery
                ? `No orders match "${searchQuery}"`
                : status === "all"
                  ? "No orders yet"
                  : `No ${status.toLowerCase()} orders`
            }
            hint={
              searchQuery
                ? "Try a different order number, phone number or name."
                : "Customer orders placed at checkout will appear here."
            }
          />
        </div>
      ) : (
        <ul className="space-y-4">
          {(result?.rows ?? []).map((order) => (
            <li key={order.id} className="bg-card rounded-xl border p-5 shadow-soft">
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

              {/* Items */}
              <ul className="border-t mt-4 pt-3 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3 py-1">
                    <span className="min-w-0 truncate">
                      {item.productName} × {item.quantity}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatPrice(item.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Status management */}
              <form
                action={updateOrderStatusAction}
                className="border-t mt-4 flex items-center gap-3 pt-4"
              >
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
                  {ORDER_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline">
                  Save
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {!failed && totalPages > 1 && (
        <nav aria-label="Orders pagination" className="mt-8 flex items-center justify-center gap-3">
          {page > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={filterHref(status, searchQuery, String(page - 1))}>Previous</Link>
            </Button>
          )}
          <span className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Button variant="outline" size="sm" asChild>
              <Link href={filterHref(status, searchQuery, String(page + 1))}>Next</Link>
            </Button>
          )}
        </nav>
      )}
    </Container>
  );
}
