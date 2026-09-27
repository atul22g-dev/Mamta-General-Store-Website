import "server-only";

import { readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";

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

/**
 * POST with a custom CA (node:https). Used when N8N_WEBHOOK_CA_FILE points
 * at a PEM file — e.g. the self-signed certificate of a self-hosted n8n —
 * because global fetch cannot take a `ca` option. The CA is PINNED: only
 * this one host is trusted with it, verification stays fully on.
 */
function postWithCa(
  target: URL,
  headers: Record<string, string>,
  body: string,
  ca: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      {
        hostname: target.hostname,
        port: target.port || 443,
        path: target.pathname + target.search,
        method: "POST",
        headers,
        ca,
        timeout: TIMEOUT_MS,
        servername: target.hostname,
      },
      (response) => {
        response.resume(); // drain so the socket completes
        response.on("end", () => resolve(response.statusCode ?? 0));
      },
    );
    request.on("timeout", () => request.destroy(new Error(`timed out after ${TIMEOUT_MS} ms`)));
    request.on("error", reject);
    request.end(body);
  });
}

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

  const headers: Record<string, string> = {
    "content-type": "application/json",
    // Lets the n8n workflow filter/branch on the event type.
    "x-event": "order.placed",
    // Origin identifies the sender inside n8n (verify against siteUrl).
    "x-store-origin": siteOrigin(),
  };
  const body = JSON.stringify({ event: "order.placed", order, placedAt: new Date().toISOString() });

  try {
    let status: number;
    const caFile = process.env.N8N_WEBHOOK_CA_FILE?.trim();
    if (caFile) {
      // Self-signed / private-CA n8n host: pin its certificate.
      status = await postWithCa(new URL(webhookUrl), headers, body, readFileSync(caFile, "utf8"));
    } else {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body,
        // Hard cap so a hanging n8n can never pin the post-response task.
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = response.status;
    }
    if (status < 200 || status >= 300) {
      console.error(`[n8n] webhook responded ${status} for order ${order.orderNumber}`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[n8n] webhook failed for order ${order.orderNumber}: ${reason}`);
  }
}
