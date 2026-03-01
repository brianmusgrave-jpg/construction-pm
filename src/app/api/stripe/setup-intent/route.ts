/**
 * @file /api/stripe/setup-intent
 * @description Create a Stripe SetupIntent so the org can store a card on file (Sprint 18).
 *
 * If the org already has a Stripe customer, reuse it; otherwise create one.
 * Returns the clientSecret for the front-end to confirm via Stripe.js.
 *
 * Alternatively the org owner can manage payment methods via the Stripe
 * Billing Portal (Sprint 15). This endpoint is a convenience for an
 * in-app card-on-file flow.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

const dbc = db as any;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = (session.user as any).orgId;
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  // Only org owners and admins can add payment methods
  const role = (session.user as any).role || "VIEWER";
  const isOwner = (session.user as any).isOrgOwner === true;
  if (role !== "ADMIN" && !isOwner) {
    return NextResponse.json({ error: "Billing access required" }, { status: 403 });
  }

  try {
    const stripe = getStripe();

    // Get or create Stripe customer for this org
    const org = await dbc.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, stripeCustomerId: true },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    let customerId = org.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name || undefined,
        metadata: { orgId },
      });
      customerId = customer.id;
      await dbc.organization.update({
        where: { id: orgId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create SetupIntent for saving a card
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: { orgId },
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (err: any) {
    console.error("[setup-intent] Error:", err);
    return NextResponse.json({ error: "Failed to create setup intent" }, { status: 500 });
  }
}
