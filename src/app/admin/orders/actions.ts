"use server";

import { revalidatePath } from "next/cache";

import { getAdminSession } from "@/lib/auth/session";
import { ORDER_STATUSES, updateOrderStatus, type OrderStatus } from "@/lib/supabase/admin-orders";

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
