import "server-only";

import { siteUrl } from "@/config/site";

/**
 * n8n webhook notification for new orders.
 *
 * Fire-and-forget by design: an n8n outage must never block or fail a
 * customer's checkout. The POST is scheduled with next/server `after()` (runs
 * after the response is sent), uses an AbortController timeout, and every
 * error path only logs.
 *
 * Configure N8N_WEBHOOK_URL in .env (the full production webhook URL from
 * your n8n Webhook node). When unset, this is a silent no-op.
 *
 * Payload note: the checkout action only holds product/variant ids and
 * quantities — the server-side place_order RPC computes prices/totals and
 * returns just the order number (and anon cannot read orders back, by RLS
 * design). n8n should look the order up by `order.orderNumber` in the
 * database for authoritative money/line data.
 */

/** Never let a slow webhook hold resources: hard cap. */
const TIMEOUT_MS = 5_000;

export interface OrderNotification {
  orderNumber: string;
  customerName: string;
  mobile: string;
  addressLine: string;
  city: string;
  state: string;
  pinCode: string;
  items: Array<{
    productId: string;
    quantity: number;
    sizeId: string | null;
    colorId: string | null;
  }>;
}

function siteOrigin(): string {
  try {
    return new URL(siteUrl).origin;
  } catch {
    return "";
  }
}

/**
 * POST the order to the n8n webhook. Resolves always; failures are logged,
 * never thrown (checkout already succeeded — notification is best-effort).
 */
export async function notifyOrderWebhook(order: OrderNotification): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL?.trim();
  if (!webhookUrl) return; // not configured — silent no-op

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Lets the n8n workflow filter/branch on the event type.
        "x-event": "order.placed",
        // Origin identifies the sender inside n8n (verify against siteUrl).
        "x-store-origin": siteOrigin(),
      },
      body: JSON.stringify({ event: "order.placed", order, placedAt: new Date().toISOString() }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`[n8n] webhook responded ${response.status} for order ${order.orderNumber}`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[n8n] webhook failed for order ${order.orderNumber}: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}
