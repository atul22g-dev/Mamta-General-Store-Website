import type { Metadata } from "next";
import { Layers, PackageCheck, Package, ReceiptText, Tag } from "lucide-react";

import { getDashboardData } from "@/lib/supabase/admin-stats";
import { formatPrice } from "@/lib/utils";
import { StatCard } from "@/components/admin/stat-card";
import { SectionCard } from "@/components/admin/section-card";
import { DatabaseErrorState, EmptyState } from "@/components/admin/empty-state";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Dashboard" };

/** Force dynamic rendering: stats must never come from a stale cache. */
export const dynamic = "force-dynamic";

/**
 * Module-scope formatter: building an Intl.DateTimeFormat loads locale data
 * and allocates heavily, so it's created once and reused for every date.
 * The locale is a fixed constant here, so caching is safe.
 */
const dashboardDateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});

function formatDate(date: Date): string {
  return dashboardDateFormat.format(date);
}

export default async function AdminDashboardPage() {
  let data: Awaited<ReturnType<typeof getDashboardData>> | null = null;
  let dbAvailable = true;

  try {
    data = await getDashboardData();
  } catch {
    // Database unreachable (e.g. local dev without PostgreSQL running).
    dbAvailable = false;
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Store overview — catalog and orders at a glance."
      />

      {!dbAvailable || !data ? (
        <SectionCard title="Statistics">
          <DatabaseErrorState />
        </SectionCard>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total products"
              value={data.stats.totalProducts}
              icon={Package}
              href="/admin/products"
              hint={`${data.stats.activeProducts} active`}
            />
            <StatCard
              label="Active products"
              value={data.stats.activeProducts}
              icon={PackageCheck}
              href="/admin/products"
            />
            <StatCard
              label="Categories"
              value={data.stats.categories}
              icon={Tag}
              href="/admin/categories"
            />
            <StatCard
              label="Orders"
              value={data.stats.orders}
              icon={ReceiptText}
              href="/admin/orders"
            />
          </div>

          {/* Recent activity */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Recent products"
              actionLabel="View all"
              actionHref="/admin/products"
            >
              {data.recentProducts.length === 0 ? (
                <EmptyState
                  icon={Package}
                  message="No products yet"
                  hint="Add your first product from the Products page."
                />
              ) : (
                <ul className="divide-y">
                  {data.recentProducts.map((product) => (
                    <li key={product.id} className="py-3 first:pt-0 last:pb-0">
                      {/* Stack name above badges on phones (long suit-material
                          names would truncate to nothing beside them); row
                          layout from sm: up. */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="min-w-0">
                          <p className="text-sm leading-snug font-medium">{product.name}</p>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {product.categoryName ?? "Uncategorized"} ·{" "}
                            {formatDate(product.createdAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {product.featured && <Badge variant="accent">Featured</Badge>}
                          <Badge variant={product.active ? "secondary" : "outline"}>
                            {product.active ? "Active" : "Draft"}
                          </Badge>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Recent orders" actionLabel="View all" actionHref="/admin/orders">
              {data.recentOrders.length === 0 ? (
                <EmptyState
                  icon={ReceiptText}
                  message="No orders yet"
                  hint="Orders will appear here as customers check out."
                />
              ) : (
                <ul className="divide-y">
                  {data.recentOrders.map((order) => (
                    <li key={order.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-medium">
                            {order.orderNumber}
                          </p>
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {order.customerName} · {formatDate(order.createdAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatPrice(order.total)}
                          </span>
                          <Badge
                            variant={
                              order.status === "DELIVERED"
                                ? "secondary"
                                : order.status === "CANCELLED"
                                  ? "destructive"
                                  : "accent"
                            }
                          >
                            {order.status.toLowerCase()}
                          </Badge>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </>
      )}

      <p className="text-muted-foreground mt-8 flex items-center gap-1.5 text-xs">
        <Layers aria-hidden="true" className="size-3.5" />
        Statistics come straight from the database — no caching, always current.
      </p>
    </div>
  );
}
