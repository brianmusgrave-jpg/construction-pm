/**
 * @file src/lib/stripe.ts
 * @description Stripe SDK singleton (Sprint 15).
 *
 * Lazy-initialises a Stripe client using the server-side secret key.
 * Used by /api/stripe/* routes and billing server actions.
 */

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set — Stripe integration is disabled");
    }
    _stripe = new Stripe(key);
  }
  return _stripe;
}

/* ------------------------------------------------------------------ */
/*  Price IDs from env                                                  */
/* ------------------------------------------------------------------ */

export function getStripePriceId(plan: "PRO" | "ENTERPRISE"): string {
  const envKey = plan === "PRO" ? "STRIPE_PRICE_PRO" : "STRIPE_PRICE_ENTERPRISE";
  const id = process.env[envKey];
  if (!id) throw new Error(`${envKey} is not set`);
  return id;
}

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
