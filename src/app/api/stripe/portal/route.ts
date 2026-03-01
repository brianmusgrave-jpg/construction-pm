/**
 * @file /api/stripe/portal
 * @description Creates a Stripe Billing Portal session for self-service (Sprint 15).
 *
 * POST — no body needed (uses session orgId).
 * Returns: { url: string } — redirect to Stripe's portal for payment method, invoices, cancel.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

const dbc = db as any;

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.user.orgId;
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    // Only owner + ADMIN can manage billing
    const role = session.user.role || "VIEWER";
    const isOwner = session.user.isOrgOwner === true;
    if (role !== "ADMIN" && !isOwner) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const org = await dbc.organization.findUnique({ where: { id: orgId } });
    if (!org?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer — subscribe to a plan first" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${appUrl}/dashboard/settings/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    console.error("[stripe/portal]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
