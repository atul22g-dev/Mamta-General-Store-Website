import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, Search } from "lucide-react";

import { listAdminOrders, ORDER_STATUSES, type OrderStatus } from "@/lib/supabase/admin-orders";
import { OrderCard } from "./order-card";
import { DatabaseErrorState, EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

interface OrdersPageProps {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}

const ORDERS_PAGE_SIZE = 20;

/** Build a filter link preserving the other parameters. */
function filterHref(status: string, q?: string, page?: string): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (q) params.set("q", q);
  if (page && page !== "1") params.set("page", page);
  const qs = params.toString();
  return `/admin/orders${qs ? `?${qs}` : ""}`;
}

/** Search box + status filter chips. Pure display — the page owns the data. */
function OrdersToolbar({
  status,
  searchQuery,
}: {
  status: OrderStatus | "all";
  searchQuery: string;
}) {
  return (
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
  );
}

/** Previous / page count / next — hidden while there is a single page. */
function OrdersPagination({
  status,
  searchQuery,
  page,
  totalPages,
}: {
  status: OrderStatus | "all";
  searchQuery: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  return (
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
  );
}

/** Quiet placeholder for "nothing matches this filter" — owns the copy rules. */
function OrdersEmptyState({
  status,
  searchQuery,
}: {
  status: OrderStatus | "all";
  searchQuery: string;
}) {
  const message = searchQuery
    ? `No orders match "${searchQuery}"`
    : status === "all"
      ? "No orders yet"
      : `No ${status.toLowerCase()} orders`;
  const hint = searchQuery
    ? "Try a different order number, phone number or name."
    : "Customer orders placed at checkout will appear here.";

  return (
    <div className="bg-card rounded-xl border shadow-soft">
      <EmptyState icon={PackageSearch} message={message} hint={hint} />
    </div>
  );
}

interface OrdersViewState {
  status: OrderStatus | "all";
  page: number;
  searchQuery: string;
  result: Awaited<ReturnType<typeof listAdminOrders>> | null;
  failed: boolean;
}

/** Parse + validate the URL params, then load the matching page of orders. */
async function loadOrdersView(
  searchParams: OrdersPageProps["searchParams"],
): Promise<OrdersViewState> {
  const { status: statusParam = "all", q = "", page: pageParam = "1" } = await searchParams;
  const status = (ORDER_STATUSES as string[]).includes(statusParam)
    ? (statusParam as OrderStatus)
    : "all";
  const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);
  const searchQuery = q.trim().slice(0, 100);

  try {
    const result = await listAdminOrders({
      status,
      query: searchQuery,
      page,
      pageSize: ORDERS_PAGE_SIZE,
    });
    return { status, page, searchQuery, result, failed: false };
  } catch {
    // The page renders its graceful fallback instead of crashing.
    return { status, page, searchQuery, result: null, failed: true };
  }
}

/** The three content states (error / empty / list) plus pagination. */
function OrdersContent({ view }: { view: OrdersViewState }) {
  if (view.failed) {
    return (
      <div className="bg-card rounded-xl border shadow-soft">
        <DatabaseErrorState />
      </div>
    );
  }

  const result = view.result;
  if (!result || result.rows.length === 0) {
    return <OrdersEmptyState status={view.status} searchQuery={view.searchQuery} />;
  }

  const totalPages = Math.max(1, Math.ceil(result.total / ORDERS_PAGE_SIZE));

  return (
    <>
      {" "}
      <ul className="space-y-4">
        {result.rows.map((order) => (
          <OrderCard key={order.id} order={order} statuses={ORDER_STATUSES} />
        ))}
      </ul>
      <OrdersPagination
        status={view.status}
        searchQuery={view.searchQuery}
        page={view.page}
        totalPages={totalPages}
      />
    </>
  );
}

/** Admin orders: searchable, filterable list with per-order status management. */
export default async function AdminOrdersPage({ searchParams }: OrdersPageProps) {
  const view = await loadOrdersView(searchParams);

  return (
    <Container className="py-8">
      <PageHeader
        title="Orders"
        description="Review incoming orders and update fulfilment status."
      />

      <OrdersToolbar status={view.status} searchQuery={view.searchQuery} />
      <OrdersContent view={view} />
    </Container>
  );
}
