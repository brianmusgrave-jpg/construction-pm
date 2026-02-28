"use server";

/**
 * @file actions/webhooks.ts
 * @description Server actions for webhook endpoint management and dispatch.
 *
 * Webhooks allow external services (e.g. Zapier, custom integrations) to receive
 * real-time POST notifications when events occur in Construction PM.
 *
 * Each webhook endpoint has:
 *   - A name and HTTPS URL
 *   - A set of subscribed event types (from WEBHOOK_EVENTS in lib/webhook-events.ts)
 *   - A generated HMAC secret (prefixed "whsec_") for payload signature verification
 *   - An active/inactive toggle
 *   - lastTriggeredAt and lastStatusCode for delivery monitoring
 *
 * Dispatch (`dispatchWebhook`):
 *   - Called from server actions or the notification pipeline when events fire
 *   - Iterates all active webhooks; skips those not subscribed to the event
 *   - Signs the payload with HMAC-SHA256 using the endpoint's secret
 *   - Fires HTTP POST requests as fire-and-forget (10s timeout)
 *   - Updates lastTriggeredAt/lastStatusCode after each delivery attempt
 *   - A status of 0 indicates a network-level failure (timeout, DNS, etc.)
 *
 * Signature verification (by the receiving server):
 *   Compute HMAC-SHA256 of the raw request body using the shared secret.
 *   Compare against the `X-Webhook-Signature` header value (`sha256=<hex>`).
 *
 * Type note: WEBHOOK_EVENTS is defined in `@/lib/webhook-events` to avoid
 * the "use server" export restriction.
 */

import { createHmac, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";
import type { Webhook } from "@/lib/db-types";

/** Internal helper — throws if not authenticated, returns userId. */
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  return session.user.id;
}

// WEBHOOK_EVENTS lives in lib/ to satisfy the "use server" export restriction
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { WEBHOOK_EVENTS } from "@/lib/webhook-events";
export type { WebhookEvent } from "@/lib/webhook-events";

// ── Queries ──

/**
 * Fetch all registered webhook endpoints, newest first.
 *
 * Requires: authenticated session.
 */
export async function getWebhooks(): Promise<Webhook[]> {
  await requireAuth();
  return db.webhook.findMany({ orderBy: { createdAt: "desc" } });
}

// ── Mutations ──

/**
 * Register a new webhook endpoint.
 * Generates a random HMAC secret (`whsec_` + 48 hex chars) stored on the record.
 * The secret is shown to the user once (in the settings UI) for them to save.
 *
 * Validates: name non-empty, URL uses HTTPS, at least one event selected.
 *
 * Requires: authenticated session.
 */
export async function createWebhook(data: {
  name: string;
  url: string;
  events: string[];
}): Promise<void> {
  await requireAuth();
  if (!data.name.trim()) throw new Error("Name is required");
  if (!data.url.startsWith("https://")) throw new Error("URL must use HTTPS");
  if (data.events.length === 0) throw new Error("Select at least one event");

  // Generate a secure random secret for HMAC signature verification
  const secret = "whsec_" + randomBytes(24).toString("hex");
  await db.webhook.create({
    data: {
      name: data.name.trim(),
      url: data.url,
      secret,
      events: data.events,
      active: true,
    },
  });
  revalidatePath("/dashboard/settings");
}

/**
 * Enable or disable a webhook endpoint without deleting it.
 * Inactive webhooks are skipped during dispatch.
 *
 * Requires: authenticated session.
 */
export async function toggleWebhook(id: string, active: boolean): Promise<void> {
  await requireAuth();
  await db.webhook.update({ where: { id }, data: { active } });
  revalidatePath("/dashboard/settings");
}

/**
 * Permanently delete a webhook endpoint.
 *
 * Requires: authenticated session.
 */
export async function deleteWebhook(id: string): Promise<void> {
  await requireAuth();
  await db.webhook.delete({ where: { id } });
  revalidatePath("/dashboard/settings");
}

// ── Dispatch ──

/**
 * Deliver a webhook event to all active, subscribed endpoints.
 * Called internally from server actions when significant events occur
 * (e.g. change order approved, phase status changed).
 *
 * Delivery is fire-and-forget with a 10-second timeout per endpoint.
 * Each delivery attempt records `lastTriggeredAt` and the HTTP response
 * status code (0 on network failure).
 *
 * Payload shape sent to the endpoint:
 * ```json
 * {
 *   "event": "change_order.approved",
 *   "timestamp": "2025-01-15T12:00:00.000Z",
 *   "data": { ...eventPayload }
 * }
 * ```
 *
 * Headers sent:
 *   - `X-Webhook-Event`:     the event string
 *   - `X-Webhook-Signature`: `sha256=<hmac-hex>` for verification
 *
 * @param event   - Event string from WEBHOOK_EVENTS (e.g. "phase.status_changed")
 * @param payload - Arbitrary event data to include in the `data` field
 */
export async function dispatchWebhook(event: string, payload: Record<string, unknown>): Promise<void> {
  const webhooks: Webhook[] = await db.webhook.findMany({
    where: { active: true },
  });

  for (const wh of webhooks) {
    // Skip endpoints not subscribed to this event ("*" = subscribe to all)
    if (!wh.events.includes(event) && !wh.events.includes("*")) continue;

    const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
    const sig = createHmac("sha256", wh.secret).update(body).digest("hex");

    // Fire-and-forget POST with HMAC signature header
    fetch(wh.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
        "X-Webhook-Signature": `sha256=${sig}`,
      },
      body,
      signal: AbortSignal.timeout(10000), // 10-second delivery timeout
    })
      .then((res) =>
        // Record successful delivery with HTTP status code
        db.webhook.update({
          where: { id: wh.id },
          data: { lastTriggeredAt: new Date(), lastStatusCode: res.status },
        })
      )
      .catch(() =>
        // Record network failure with status 0
        db.webhook.update({
          where: { id: wh.id },
          data: { lastTriggeredAt: new Date(), lastStatusCode: 0 },
        })
      );
  }
}
