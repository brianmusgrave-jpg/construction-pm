"use server";

import { createHmac, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";
import type { Webhook } from "@/lib/db-types";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  return session.user.id;
}

// WEBHOOK_EVENTS moved to @/lib/webhook-events to avoid "use server" export restriction
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { WEBHOOK_EVENTS } from "@/lib/webhook-events";
export type { WebhookEvent } from "@/lib/webhook-events";

export async function getWebhooks(): Promise<Webhook[]> {
  await requireAuth();
  return db.webhook.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createWebhook(data: {
  name: string;
  url: string;
  events: string[];
}): Promise<void> {
  await requireAuth();
  if (!data.name.trim()) throw new Error("Name is required");
  if (!data.url.startsWith("https://")) throw new Error("URL must use HTTPS");
  if (data.events.length === 0) throw new Error("Select at least one event");

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

export async function toggleWebhook(id: string, active: boolean): Promise<void> {
  await requireAuth();
  await db.webhook.update({ where: { id }, data: { active } });
  revalidatePath("/dashboard/settings");
}

export async function deleteWebhook(id: string): Promise<void> {
  await requireAuth();
  await db.webhook.delete({ where: { id } });
  revalidatePath("/dashboard/settings");
}

// Dispatch helper — called from notification pipeline or server actions
export async function dispatchWebhook(event: string, payload: Record<string, unknown>): Promise<void> {
  const webhooks: Webhook[] = await db.webhook.findMany({
    where: { active: true },
  });

  for (const wh of webhooks) {
    if (!wh.events.includes(event) && !wh.events.includes("*")) continue;

    const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
    const sig = createHmac("sha256", wh.secret).update(body).digest("hex");

    // Fire-and-forget with status tracking
    fetch(wh.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
        "X-Webhook-Signature": `sha256=${sig}`,
      },
      body,
      signal: AbortSignal.timeout(10000),
    })
      .then((res) =>
        db.webhook.update({
          where: { id: wh.id },
          data: { lastTriggeredAt: new Date(), lastStatusCode: res.status },
        })
      )
      .catch(() =>
        db.webhook.update({
          where: { id: wh.id },
          data: { lastTriggeredAt: new Date(), lastStatusCode: 0 },
        })
      );
  }
}
