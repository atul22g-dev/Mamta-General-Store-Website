"use server";

import { revalidatePath } from "next/cache";

import { getAdminSession } from "@/lib/auth/session";
import {
  deleteOrder,
  ORDER_STATUSES,
  updateOrderStatus,
  type OrderStatus,
} from "@/lib/supabase/admin-orders";

/**
 * Order server actions. This module is imported by client components, so it
 * must not export anything except async functions ("use server" boundary);
 * all server-only imports are confined here.
 */

/** Status update for one order. Admin session required; input validated. */
export async function updateOrderStatusAction(formData: FormData): Promise<void> {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");

  const id = formData.get("id")?.toString();
  const status = formData.get("status")?.toString() as OrderStatus | undefined;
  if (!id || !status || !ORDER_STATUSES.includes(status)) return;

  await updateOrderStatus(id, status);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/dashboard");
}

/**
 * Permanently delete one order (admin-gated). The client-side confirm dialog
 * gates the call; line items are removed by the schema's cascade.
 */
export async function deleteOrderAction(formData: FormData): Promise<void> {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");

  const id = formData.get("id")?.toString();
  if (!id) return;

  try {
    await deleteOrder(id);
  } catch {
    // Non-fatal for the list render; the row keeps its previous state.
  }
  revalidatePath("/admin/orders");
  revalidatePath("/admin/dashboard");
}
