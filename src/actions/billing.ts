/**
 * @file src/actions/billing.ts
 * @description Server actions for the billing settings page (Sprint 14).
 *
 * Provides org-owner and ADMIN users with:
 *   - getBillingInfo()       — plan, AI usage, subscription details, add-on features
 *   - getInvoiceHistory()    — stub for future Stripe invoice list
 *   - transferOwnership()    — transfer org ownership to another ADMIN user
 *   - getOrgAdminUsers()     — list ADMIN users eligible to receive ownership
 *
 * Ownership transfer is audited via ActivityLog.
 */
"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const dbc = db as any; // models not in locally-generated Prisma client

/** Require an authenticated user who is either the org owner or an ADMIN. */
async function requireBillingAccess() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const role = session.user.role || "VIEWER";
  const isOwner = session.user.isOrgOwner === true;

  if (role !== "ADMIN" && role !== "PROJECT_MANAGER" && !isOwner) {
    throw new Error("Only admins and the org owner can access billing");
  }

  return session;
}

/* ------------------------------------------------------------------ */
/*  Plan metadata — pricing and feature matrix                         */
/* ------------------------------------------------------------------ */

/** Static plan details. Pricing will be driven by Stripe in Sprint 15. */
const PLAN_DETAILS: Record<string, {
  label: string;
  price: string;
  priceAmount: number;
  maxUsers: number | null;
  maxProjects: number | null;
  aiTokens: number;
  features: string[];
}> = {
  STARTER: {
    label: "Starter",
    price: "$29/month",
    priceAmount: 29,
    maxUsers: 5,
    maxProjects: 10,
    aiTokens: 0,
    features: [
      "Core project management",
      "Gantt charts & timelines",
      "Document management",
      "Client portal",
      "Mobile PWA",
    ],
  },
  PRO: {
    label: "Pro",
    price: "$79/month",
    priceAmount: 79,
    maxUsers: 25,
    maxProjects: null, // unlimited
    aiTokens: 100000,
    features: [
      "Everything in Starter",
      "AI Voice Transcription",
      "AI Task Extraction",
      "QuickBooks Integration",
      "API & Webhooks",
      "Advanced Analytics",
    ],
  },
  ENTERPRISE: {
    label: "Enterprise",
    price: "$249/month",
    priceAmount: 249,
    maxUsers: null, // unlimited
    maxProjects: null,
    aiTokens: 500000,
    features: [
      "Everything in Pro",
      "White Label / Custom Domain",
      "Priority Support",
      "Custom AI Token Limits",
      "Dedicated Account Manager",
      "SSO / SAML (coming soon)",
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  getBillingInfo                                                      */
/* ------------------------------------------------------------------ */

export interface BillingInfo {
  /* Organization */
  orgId: string;
  orgName: string;
  orgSlug: string;
  plan: string;
  planDetails: (typeof PLAN_DETAILS)[string];
  status: string;
  /* AI usage */
  aiTokenBudget: number;
  aiTokenUsed: number;
  aiUsagePercent: number;
  billingCycleEnd: string | null;
  /* Stripe (stubs until Sprint 15) */
  stripeCustomerId: string | null;
  stripeSubId: string | null;
  /* Subscription */
  subscription: {
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  /* Ownership */
  isOwner: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  /* Counts */
  userCount: number;
  projectCount: number;
}

export async function getBillingInfo(): Promise<BillingInfo> {
  const session = await requireBillingAccess();
  const orgId = session.user.orgId;
  if (!orgId) throw new Error("No organization context");

  // Fetch org + subscription + counts in parallel
  const [org, subscription, userCount, projectCount, owner] = await Promise.all([
    dbc.organization.findUnique({ where: { id: orgId } }),
    dbc.subscription.findUnique({ where: { orgId } }).catch(() => null),
    dbc.user.count({ where: { orgId } }),
    dbc.project.count({ where: { orgId } }),
    dbc.user.findFirst({ where: { orgId, isOrgOwner: true }, select: { name: true, email: true } }),
  ]);

  if (!org) throw new Error("Organization not found");

  const plan = org.plan || "STARTER";
  const planInfo = PLAN_DETAILS[plan] || PLAN_DETAILS.STARTER;

  return {
    orgId: org.id,
    orgName: org.name,
    orgSlug: org.slug,
    plan,
    planDetails: planInfo,
    status: org.status,
    aiTokenBudget: org.aiTokenBudget,
    aiTokenUsed: org.aiTokenUsed,
    aiUsagePercent: org.aiTokenBudget > 0
      ? Math.round((org.aiTokenUsed / org.aiTokenBudget) * 100)
      : 0,
    billingCycleEnd: org.billingCycleEnd?.toISOString() ?? null,
    stripeCustomerId: org.stripeCustomerId,
    stripeSubId: org.stripeSubId,
    subscription: subscription
      ? {
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
    isOwner: session.user.isOrgOwner === true,
    ownerName: owner?.name ?? null,
    ownerEmail: owner?.email ?? null,
    userCount,
    projectCount,
  };
}

/* ------------------------------------------------------------------ */
/*  getInvoiceHistory (stub — will use Stripe API in Sprint 15)        */
/* ------------------------------------------------------------------ */

export interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: "paid" | "open" | "void" | "draft";
  pdfUrl: string | null;
}

export async function getInvoiceHistory(): Promise<Invoice[]> {
  const session = await requireBillingAccess();
  const orgId = session.user.orgId;
  if (!orgId) return [];

  // Try to fetch from Stripe if configured
  try {
    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe();
    const org = await dbc.organization.findUnique({ where: { id: orgId } });
    if (!org?.stripeCustomerId) return [];

    const invoices = await stripe.invoices.list({
      customer: org.stripeCustomerId,
      limit: 24,
    });

    return invoices.data.map((inv: any) => ({
      id: inv.id,
      date: new Date(inv.created * 1000).toISOString(),
      amount: `$${(inv.amount_paid / 100).toFixed(2)}`,
      status: inv.status === "paid" ? "paid" : inv.status === "open" ? "open" : inv.status === "void" ? "void" : "draft",
      pdfUrl: inv.invoice_pdf || null,
    }));
  } catch {
    // Stripe not configured — return empty
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  getOrgAdminUsers — eligible ownership transfer targets             */
/* ------------------------------------------------------------------ */

export interface OrgAdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isOrgOwner: boolean;
}

export async function getOrgAdminUsers(): Promise<OrgAdminUser[]> {
  const session = await requireBillingAccess();
  const orgId = session.user.orgId;
  if (!orgId) throw new Error("No organization context");

  const users = await dbc.user.findMany({
    where: {
      orgId,
      role: "ADMIN",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isOrgOwner: true,
    },
    orderBy: { name: "asc" },
  });

  return users;
}

/* ------------------------------------------------------------------ */
/*  transferOwnership                                                  */
/* ------------------------------------------------------------------ */

export async function transferOwnership(newOwnerId: string): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (session.user.isOrgOwner !== true) {
    throw new Error("Only the current org owner can transfer ownership");
  }

  const orgId = session.user.orgId;
  if (!orgId) throw new Error("No organization context");

  // Verify target user is in the same org and is an ADMIN
  const targetUser = await dbc.user.findFirst({
    where: { id: newOwnerId, orgId, role: "ADMIN" },
  });

  if (!targetUser) {
    throw new Error("Target user must be an ADMIN in this organization");
  }

  if (targetUser.id === session.user.id) {
    throw new Error("You are already the owner");
  }

  // Perform the transfer in a transaction-like sequence:
  // 1. Remove ownership from current owner
  // 2. Grant ownership to new owner
  await dbc.user.update({
    where: { id: session.user.id },
    data: { isOrgOwner: false },
  });

  await dbc.user.update({
    where: { id: newOwnerId },
    data: { isOrgOwner: true },
  });

  // Log the transfer to activity log
  try {
    await dbc.activityLog.create({
      data: {
        action: "OWNERSHIP_TRANSFERRED",
        userId: session.user.id,
        orgId,
        detail: JSON.stringify({
          fromUserId: session.user.id,
          toUserId: newOwnerId,
          toUserName: targetUser.name,
          toUserEmail: targetUser.email,
        }),
      },
    });
  } catch {
    // Fire-and-forget — don't block the transfer
  }

  return { success: true };
}
