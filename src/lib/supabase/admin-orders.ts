import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Admin order management — list with filters and status updates.
 * Order rows already snapshot customer/address/item data, so the list is a
 * simple indexed select; line items come along as an embedded read.
 */

export type OrderStatus =
  "PENDING" | "CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

export interface AdminOrderItem {
  id: string;
  productName: string;
  productSlug: string;
  /** Cover image URL of the ordered product, when it still has one. */
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string | null;
  shippingLine1: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  total: number;
  itemCount: number;
  createdAt: Date;
  items: AdminOrderItem[];
}

export interface OrderListResult {
  rows: AdminOrder[];
  total: number;
}

export interface OrderListParams {
  /** all | PENDING | CONFIRMED | PACKED | SHIPPED | DELIVERED | CANCELLED */
  status?: OrderStatus | "all";
  /** Free-text search: order number, customer, phone, city or PIN code. */
  query?: string;
  page?: number;
  pageSize?: number;
}

const LIST_SELECT = `
  id, "orderNumber", status, "customerName", "customerPhone",
  "shippingLine1", "shippingCity", "shippingState", "shippingPostalCode",
  total, "createdAt",
  order_items ( id, "productId", "productName", "productSlug", quantity, "unitPrice", "lineTotal" )
`;

interface ListRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string | null;
  shippingLine1: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  total: number;
  createdAt: string;
  order_items:
    | {
        id: string;
        productId: string | null;
        productName: string;
        productSlug: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }[]
    | null;
}

/** Orders with items, filters, search and pagination (admin list). */
export async function listAdminOrders(params: OrderListParams = {}): Promise<OrderListResult> {
  const { status = "all", page = 1, pageSize = 20 } = params;
  const client = await getSupabaseAdminClient();

  let query = client
    .from("orders")
    .select(LIST_SELECT, { count: "exact" })
    .order("createdAt", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (status !== "all") query = query.eq("status", status);

  // Free-text search across the columns an admin would look an order up by.
  // PostgREST or-filter: strip %, commas and parens so the input can't alter
  // the filter syntax; double-quoted camelCase identifiers.
  const search = params.query?.trim() ?? "";
  const sanitized = search.replace(/[%,()]/g, "");
  if (sanitized) {
    const pattern = `%${sanitized}%`;
    query = query.or(
      [
        `"orderNumber".ilike.${pattern}`,
        `"customerName".ilike.${pattern}`,
        `"customerPhone".ilike.${pattern}`,
        `"shippingCity".ilike.${pattern}`,
        `"shippingPostalCode".ilike.${pattern}`,
      ].join(","),
    );
  }

  const { data, count, error } = await query;
  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  const orderRows = (data ?? []) as unknown as ListRow[];

  // Resolve each ordered product's cover image (position 0) in one query —
  // rows snapshot product name/slug/price, so images are the only live
  // lookup. Missing/legacy rows map to null and render a placeholder.
  const productIds = [
    ...new Set(
      orderRows.flatMap((row) =>
        (row.order_items ?? [])
          .map((item) => item.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  ];
  const coverByProduct = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: covers, error: coversError } = await client
      .from("product_images")
      .select("productId, url")
      .in("productId", productIds)
      .eq("position", 0);
    if (coversError) throw new Error(`Failed to load product images: ${coversError.message}`);
    for (const cover of (covers ?? []) as { productId: string; url: string }[]) {
      coverByProduct.set(cover.productId, cover.url);
    }
  }

  const rows = orderRows.map((row) => ({
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    shippingLine1: row.shippingLine1,
    shippingCity: row.shippingCity,
    shippingState: row.shippingState,
    shippingPostalCode: row.shippingPostalCode,
    total: row.total,
    itemCount: (row.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0),
    createdAt: new Date(row.createdAt),
    items: (row.order_items ?? []).map((item) => ({
      id: item.id,
      productName: item.productName,
      productSlug: item.productSlug,
      productImage: item.productId ? (coverByProduct.get(item.productId) ?? null) : null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
  }));

  return { rows, total: count ?? 0 };
}

/**
 * Permanently delete an order and its line items. Intended for test,
 * duplicate or spam orders — real orders should be CANCELLED instead so
 * revenue history stays intact. Line items cascade (schema-level FK).
 */
export async function deleteOrder(id: string): Promise<void> {
  const { error } = await (await getSupabaseAdminClient()).from("orders").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete order: ${error.message}`);
}

/** Update an order's fulfilment status. */
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await (
    await getSupabaseAdminClient()
  )
    .from("orders")
    .update({ status } as never)
    .eq("id", id);
  if (error) throw new Error(`Failed to update order: ${error.message}`);
}
