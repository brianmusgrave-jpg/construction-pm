/**
 * @file /api/stripe/webhook
 * @description Stripe webhook handler (Sprint 15).
 *
 * Handles:
 *   - checkout.session.completed → activate subscription
 *   - invoice.payment_failed → mark org PAST_DUE
 *   - customer.subscription.deleted → mark org CANCELLED
 *   - customer.subscription.updated → update plan/status/period
 *
 * Webhook secret must match STRIPE_WEBHOOK_SECRET env var.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import type Stripe from "stripe";

const dbc = db as any;

// Disable body parsing — Stripe needs the raw body for signature verification
export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/*  Plan mapping from Stripe Price ID → OrgPlan                        */
/* ------------------------------------------------------------------ */
function planFromPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return "ENTERPRISE";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "PRO";
  return "STARTER";
}

/* ------------------------------------------------------------------ */
/*  Helpers: extract period timestamps from subscription               */
/* ------------------------------------------------------------------ */
function getPeriodStart(sub: any): Date {
  const val = sub.current_period_start;
  if (typeof val === "number") return new Date(val * 1000);
  return new Date(val);
}

function getPeriodEnd(sub: any): Date {
  const val = sub.current_period_end;
  if (typeof val === "number") return new Date(val * 1000);
  return new Date(val);
}

/* ------------------------------------------------------------------ */
/*  Webhook handler                                                     */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    if (!sig || !STRIPE_WEBHOOK_SECRET) {
      console.warn("[stripe/webhook] Missing signature or webhook secret");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[stripe/webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      /* ---- Checkout completed → create/activate subscription ---- */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.orgId;
        const plan = session.metadata?.plan || "PRO";

        if (!orgId) {
          console.warn("[stripe/webhook] checkout.session.completed missing orgId metadata");
          break;
        }

        // Retrieve full subscription details
        const subId = session.subscription as string;
        if (subId) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(subId);
          const priceId = sub.items.data[0]?.price?.id || "";

          // Upsert subscription record
          await dbc.subscription.upsert({
            where: { orgId },
            create: {
              orgId,
              stripeSubId: subId,
              stripePriceId: priceId,
              status: sub.status,
              currentPeriodStart: getPeriodStart(sub),
              currentPeriodEnd: getPeriodEnd(sub),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            },
            update: {
              stripeSubId: subId,
              stripePriceId: priceId,
              status: sub.status,
              currentPeriodStart: getPeriodStart(sub),
              currentPeriodEnd: getPeriodEnd(sub),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            },
          });

          // Update org with Stripe IDs and plan
          await dbc.organization.update({
            where: { id: orgId },
            data: {
              stripeSubId: subId,
              stripeCustomerId: session.customer as string,
              plan: planFromPriceId(priceId),
              status: "ACTIVE",
              billingCycleEnd: getPeriodEnd(sub),
            },
          });
        }

        console.log(`[stripe/webhook] Checkout completed for org ${orgId}, plan ${plan}`);
        break;
      }

      /* ---- Payment failed → mark org PAST_DUE ---- */
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const org = await dbc.organization.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (org) {
          await dbc.organization.update({
            where: { id: org.id },
            data: { status: "PAST_DUE" },
          });
          console.log(`[stripe/webhook] Payment failed — org ${org.id} marked PAST_DUE`);
        }
        break;
      }

      /* ---- Subscription deleted → cancel org ---- */
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.orgId;

        // Find org by Stripe sub ID if metadata is missing
        const org = orgId
          ? await dbc.organization.findUnique({ where: { id: orgId } })
          : await dbc.organization.findFirst({ where: { stripeSubId: sub.id } });

        if (org) {
          await dbc.organization.update({
            where: { id: org.id },
            data: { status: "CANCELLED", stripeSubId: null },
          });
          await dbc.subscription.deleteMany({ where: { orgId: org.id } });
          console.log(`[stripe/webhook] Subscription deleted — org ${org.id} marked CANCELLED`);
        }
        break;
      }

      /* ---- Subscription updated → sync plan/period ---- */
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price?.id || "";
        const newPlan = planFromPriceId(priceId);

        // Find org
        const org = await dbc.organization.findFirst({
          where: { stripeSubId: sub.id },
        });

        if (org) {
          await dbc.organization.update({
            where: { id: org.id },
            data: {
              plan: newPlan,
              status: sub.status === "active" ? "ACTIVE" : sub.status === "past_due" ? "PAST_DUE" : org.status,
              billingCycleEnd: getPeriodEnd(sub),
            },
          });

          await dbc.subscription.updateMany({
            where: { orgId: org.id },
            data: {
              stripePriceId: priceId,
              status: sub.status,
              currentPeriodStart: getPeriodStart(sub),
              currentPeriodEnd: getPeriodEnd(sub),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            },
          });

          console.log(`[stripe/webhook] Subscription updated — org ${org.id} now on ${newPlan}`);
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt
        console.log(`[stripe/webhook] Unhandled event: ${event.type}`);
    }
  } catch (err: any) {
    console.error(`[stripe/webhook] Error processing ${event.type}:`, err);
    // Return 200 anyway to prevent Stripe from retrying indefinitely
  }

  return NextResponse.json({ received: true });
}
