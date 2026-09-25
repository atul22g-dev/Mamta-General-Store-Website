import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Dashboard statistics + recent records — supabase-js implementation.
 * Counts use `head: true` (no rows transferred); recent lists are indexed
 * `ORDER BY … LIMIT` selects with a category join for products.
 */

export interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  categories: number;
  orders: number;
}

export interface RecentProduct {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  featured: boolean;
  price: number;
  categoryName: string | null;
  createdAt: Date;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: Date;
}

export interface DashboardData {
  stats: DashboardStats;
  recentProducts: RecentProduct[];
  recentOrders: RecentOrder[];
}

/** `COUNT(*)` without transferring rows; null error means success. */
async function count(
  table: "products" | "categories" | "orders",
  filters?: Record<string, boolean>,
): Promise<number> {
  let builder = (await getSupabaseAdminClient())
    .from(table)
    .select("id", { count: "exact", head: true });
  for (const [column, value] of Object.entries(filters ?? {})) {
    builder = builder.eq(column, value);
  }
  const { count: total, error } = await builder;
  if (error) throw new Error(`Failed to count ${table}: ${error.message}`);
  return total ?? 0;
}

interface RecentProductRow {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  featured: boolean;
  price: number;
  createdAt: string;
  categories: { name: string } | null;
}

interface RecentOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
}

export async function getDashboardData(): Promise<DashboardData> {
  const client = await getSupabaseAdminClient();

  const [
    totalProducts,
    activeProducts,
    categories,
    orders,
    recentProductsResult,
    recentOrdersResult,
  ] = await Promise.all([
    count("products"),
    count("products", { active: true }),
    count("categories"),
    count("orders"),

    client
      .from("products")
      .select(`id, name, slug, active, featured, price, "createdAt", categories ( name )`)
      .order("createdAt", { ascending: false })
      .limit(5),

    client
      .from("orders")
      .select(`id, "orderNumber", "customerName", status, "paymentStatus", total, "createdAt"`)
      .order("createdAt", { ascending: false })
      .limit(5),
  ]);

  if (recentProductsResult.error) {
    throw new Error(`Failed to load recent products: ${recentProductsResult.error.message}`);
  }
  if (recentOrdersResult.error) {
    throw new Error(`Failed to load recent orders: ${recentOrdersResult.error.message}`);
  }

  return {
    stats: { totalProducts, activeProducts, categories, orders },
    recentProducts: ((recentProductsResult.data ?? []) as unknown as RecentProductRow[]).map(
      (row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        active: row.active,
        featured: row.featured,
        price: row.price,
        categoryName: row.categories?.name ?? null,
        createdAt: new Date(row.createdAt),
      }),
    ),
    recentOrders: ((recentOrdersResult.data ?? []) as RecentOrderRow[]).map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      customerName: row.customerName,
      status: row.status,
      paymentStatus: row.paymentStatus,
      total: row.total,
      createdAt: new Date(row.createdAt),
    })),
  };
}
