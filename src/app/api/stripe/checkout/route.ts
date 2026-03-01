/**
 * @file /api/stripe/checkout
 * @description Creates a Stripe Checkout session for plan upgrades (Sprint 15).
 *
 * POST body: { plan: "PRO" | "ENTERPRISE" }
 * Returns: { url: string } — redirect the browser here to complete checkout.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe, getStripePriceId } from "@/lib/stripe";

const dbc = db as any;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.user.orgId;
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const { plan } = await req.json();
    if (plan !== "PRO" && plan !== "ENTERPRISE") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const stripe = getStripe();
    const priceId = getStripePriceId(plan);
    const org = await dbc.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Re-use existing Stripe customer or create new
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        email: session.user.email || undefined,
        metadata: { orgId, orgSlug: org.slug },
      });
      customerId = customer.id;
      await dbc.organization.update({
        where: { id: orgId },
        data: { stripeCustomerId: customerId },
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/settings/billing?checkout=success`,
      cancel_url: `${appUrl}/dashboard/settings/billing?checkout=cancelled`,
      subscription_data: {
        metadata: { orgId, plan },
      },
      metadata: { orgId, plan },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: any) {
    console.error("[stripe/checkout]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
