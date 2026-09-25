"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSupabasePublicClient } from "@/lib/supabase/public";
import { checkoutSchema } from "@/lib/validation/checkout";

export interface PlaceOrderState {
  /** Order number on success — the client clears the cart and shows this. */
  orderNumber?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/** Client cart items, minimally shaped for transport (a bare JSON array). */
const cartSchema = z
  .array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().min(1).max(99),
      sizeId: z.string().nullable(),
      colorId: z.string().nullable(),
    }),
  )
  .min(1, "Your cart is empty")
  .max(50);

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `MGS-${year}-${random}`;
}

/**
 * Place a cash-on-delivery order.
 *
 * Prices are NEVER taken from the client: the cart payload is only
 * product/variant ids + quantities. The `place_order` Postgres function
 * re-reads server-side prices, validates variants and stock, inserts the
 * order with snapshot data and line items, and decrements stock — all
 * atomically, exactly like the previous Prisma `$transaction`.
 */
export async function placeOrderAction(
  _prev: PlaceOrderState,
  formData: FormData,
): Promise<PlaceOrderState> {
  // 1. Validate customer details.
  const customer = checkoutSchema.safeParse({
    customerName: formData.get("customerName"),
    mobile: formData.get("mobile"),
    addressLine: formData.get("addressLine"),
    city: formData.get("city"),
    state: formData.get("state"),
    pinCode: formData.get("pinCode"),
  });

  if (!customer.success) {
    const flattened = z.flattenError(customer.error);
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: flattened.fieldErrors as Record<string, string[]>,
    };
  }

  // 2. Validate the cart payload (ids + quantities only — no prices).
  let cart: z.infer<typeof cartSchema>;
  try {
    cart = cartSchema.parse(JSON.parse(String(formData.get("cart") ?? "[]")));
  } catch {
    return { error: "Your cart could not be read. Please try again." };
  }

  if (cart.length === 0) {
    return { error: "Your cart is empty." };
  }

  // 3. Place the order atomically in the database.
  try {
    const place = async (orderNumber: string): Promise<string | null> => {
      // Public anon client: place_order is SECURITY DEFINER and granted to
      // anon — guest checkout needs no privileged key.
      const { data, error } = await getSupabasePublicClient().rpc("place_order", {
        p_items: cart,
        p_customer: {
          customerName: customer.data.customerName,
          mobile: customer.data.mobile,
          addressLine: customer.data.addressLine,
          city: customer.data.city,
          state: customer.data.state,
          pinCode: customer.data.pinCode,
        },
        p_order_number: orderNumber,
      } as never);
      if (error) {
        // Collision on the generated order number — signal a retry.
        if (error.message.includes("ORDER_NUMBER_TAKEN")) return null;
        throw new Error(error.message);
      }
      return (data as string) ?? orderNumber;
    };

    let orderNumber = await generateOrderNumber();
    const firstAttempt = await place(orderNumber);
    if (firstAttempt === null) {
      // Retry once with a fresh number (random 6-digit collision is unlikely).
      orderNumber = await generateOrderNumber();
      const secondAttempt = await place(orderNumber);
      if (secondAttempt === null) {
        return { error: "Could not place the order. Please try again." };
      }
      orderNumber = secondAttempt;
    } else {
      orderNumber = firstAttempt;
    }

    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/products");

    return { orderNumber };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not place the order.";
    // Domain errors (out of stock etc.) are safe to show; anything else is generic.
    if (/out of stock|no longer available/i.test(message)) {
      return { error: message.replace(/^(OUT_OF_STOCK|PRODUCT_GONE):\s*/i, "") };
    }
    console.error("[checkout]", error);
    return {
      error: "Something went wrong while placing your order. Please try again.",
    };
  }
}
