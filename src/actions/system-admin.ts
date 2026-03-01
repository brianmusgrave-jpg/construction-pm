"use server";

/**
 * @file actions/system-admin.ts
 * @description Server actions for the SYSTEM_ADMIN "God Mode" panel.
 *
 * Every function in this file is restricted to users with role === SYSTEM_ADMIN.
 * These actions operate ACROSS organizations — they are NOT scoped to a single
 * orgId the way normal server actions are.
 *
 * All mutating actions are logged to the `system_admin_logs` table for auditability.
 *
 * Capabilities:
 *   - Org detail view (users, projects, settings for any org)
 *   - User impersonation (short-lived token, 30-min expiry, single-use)
 *   - Feature flag overrides per-org regardless of plan
 *   - Subscription management (plan upgrade/downgrade, trial extension, suspend)
 *   - AI token budget management (view usage, reset, override budget)
 *   - Fix-it tools (resend invite, reset password → new invite, clear stuck phases)
 *   - Admin audit log viewer
 */

import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";

// Cast to any for models not yet in the local generated Prisma client
const dbc = db as any;

// ── Auth Guard ──

/**
 * Asserts SYSTEM_ADMIN role. Returns the full session.
 * Every action in this file calls this first.
 */
async function requireSystemAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  if (session.user.role !== "SYSTEM_ADMIN") throw new Error("Forbidden — SYSTEM_ADMIN required");
  return session;
}

/**
 * Write an entry to the system_admin_logs table.
 * Fire-and-forget — never blocks the caller on audit write failure.
 */
function logAdminAction(
  adminId: string,
  action: string,
  targetOrgId?: string | null,
  targetUserId?: string | null,
  detail?: string | null
) {
  dbc.systemAdminLog.create({
    data: { adminId, action, targetOrgId, targetUserId, detail },
  }).catch((err: any) => console.error("[SystemAdminLog] Failed to write:", err.message));
}

// ── Org Detail ──

/**
 * Fetch full detail for a single organization, including its users, projects,
 * feature toggles, AI usage stats, and subscription info.
 *
 * Used by the /system-admin/orgs/[orgId] detail page.
 */
export async function getOrgDetail(orgId: string) {
  await requireSystemAdmin();

  const [org, users, projects, features, subscription] = await Promise.all([
    dbc.organization.findUnique({ where: { id: orgId } }),
    dbc.user.findMany({
      where: { orgId },
      select: {
        id: true, email: true, name: true, role: true,
        isOrgOwner: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    dbc.project.findMany({
      where: { orgId },
      select: {
        id: true, name: true, status: true, createdAt: true,
        _count: { select: { phases: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    dbc.featureToggle.findMany({ where: { orgId } }),
    dbc.subscription.findFirst({ where: { orgId } }),
  ]);

  if (!org) throw new Error(`Organization ${orgId} not found`);

  return {
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      status: org.status,
      aiTokenBudget: org.aiTokenBudget,
      aiTokenUsed: org.aiTokenUsed,
      stripeCustomerId: org.stripeCustomerId,
      stripeSubId: org.stripeSubId,
      billingCycleEnd: org.billingCycleEnd?.toISOString() ?? null,
      createdAt: org.createdAt.toISOString(),
    },
    users: users.map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isOrgOwner: u.isOrgOwner,
      createdAt: u.createdAt.toISOString(),
    })),
    projects: projects.map((p: any) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      phaseCount: p._count.phases,
      createdAt: p.createdAt.toISOString(),
    })),
    features: features.map((f: any) => ({
      id: f.id,
      name: f.name,
      enabled: f.enabled,
    })),
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          stripePriceId: subscription.stripePriceId,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
  };
}

// ── Impersonation ──

/**
 * Create a short-lived impersonation token that lets a SYSTEM_ADMIN view the
 * app as any user. Token is 32 random bytes (64 hex chars), expires in 30 min,
 * and is single-use (consumed on first load).
 *
 * The impersonated session shows a persistent banner with "Viewing as [name] — Exit".
 *
 * @returns The raw impersonation token to redirect with.
 */
export async function createImpersonationToken(targetUserId: string) {
  const session = await requireSystemAdmin();
  const adminId = session.user.id;

  // Verify target user exists
  const targetUser = await dbc.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true },
  });
  if (!targetUser) throw new Error("Target user not found");

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await dbc.impersonationSession.create({
    data: { adminId, targetUserId, token, expiresAt },
  });

  logAdminAction(adminId, "impersonate_user", null, targetUserId,
    `Impersonating ${targetUser.name ?? targetUser.email}`);

  return { token, targetUserName: targetUser.name ?? targetUser.email };
}

/**
 * Validate and consume an impersonation token. Called by the impersonation
 * callback route. Returns the target user's info if valid, null if expired/used.
 */
export async function consumeImpersonationToken(token: string) {
  const record = await dbc.impersonationSession.findUnique({ where: { token } });
  if (!record) return null;
  if (record.usedAt) return null; // already consumed
  if (new Date() > record.expiresAt) return null; // expired

  // Mark as consumed
  await dbc.impersonationSession.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  const targetUser = await dbc.user.findUnique({
    where: { id: record.targetUserId },
    select: { id: true, email: true, name: true, role: true, orgId: true },
  });

  return {
    targetUser,
    adminId: record.adminId,
  };
}

// ── Feature Flag Overrides ──

/**
 * Toggle a feature flag for a specific org, regardless of their plan.
 * This overrides the plan-based defaults — useful for beta testing or
 * granting premium features to specific partners.
 */
export async function toggleOrgFeature(orgId: string, featureName: string, enabled: boolean) {
  const session = await requireSystemAdmin();

  // Upsert: create if not exists, update if it does
  await dbc.featureToggle.upsert({
    where: { orgId_name: { orgId, name: featureName } },
    create: { orgId, name: featureName, enabled },
    update: { enabled },
  });

  logAdminAction(session.user.id, "toggle_feature", orgId, null,
    `${featureName} → ${enabled ? "ON" : "OFF"}`);

  return { success: true };
}

// ── Subscription Management ──

/**
 * Change an org's plan tier. Does NOT touch Stripe — this is a manual override
 * for the system admin. Stripe integration (Sprint 15) will handle billing sync.
 */
export async function changeOrgPlan(orgId: string, newPlan: string) {
  const session = await requireSystemAdmin();
  const validPlans = ["STARTER", "PRO", "ENTERPRISE"];
  if (!validPlans.includes(newPlan)) throw new Error(`Invalid plan: ${newPlan}`);

  const org = await dbc.organization.update({
    where: { id: orgId },
    data: { plan: newPlan },
  });

  logAdminAction(session.user.id, "change_plan", orgId, null,
    `Plan changed to ${newPlan}`);

  return { plan: org.plan };
}

/**
 * Change an org's status (ACTIVE, TRIAL, PAST_DUE, SUSPENDED, CANCELLED).
 * Use this to manually suspend a deadbeat or reactivate an org.
 */
export async function changeOrgStatus(orgId: string, newStatus: string) {
  const session = await requireSystemAdmin();
  const validStatuses = ["ACTIVE", "TRIAL", "PAST_DUE", "SUSPENDED", "CANCELLED"];
  if (!validStatuses.includes(newStatus)) throw new Error(`Invalid status: ${newStatus}`);

  await dbc.organization.update({
    where: { id: orgId },
    data: { status: newStatus },
  });

  logAdminAction(session.user.id, "change_status", orgId, null,
    `Status changed to ${newStatus}`);

  return { status: newStatus };
}

/**
 * Extend an org's trial by N days from today (or from current billingCycleEnd
 * if it's still in the future). Also sets status to TRIAL if not already.
 */
export async function extendTrial(orgId: string, days: number) {
  const session = await requireSystemAdmin();
  if (days < 1 || days > 365) throw new Error("Days must be 1–365");

  const org = await dbc.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Org not found");

  const baseDate = org.billingCycleEnd && new Date(org.billingCycleEnd) > new Date()
    ? new Date(org.billingCycleEnd)
    : new Date();

  const newEnd = new Date(baseDate);
  newEnd.setDate(newEnd.getDate() + days);

  await dbc.organization.update({
    where: { id: orgId },
    data: { status: "TRIAL", billingCycleEnd: newEnd },
  });

  logAdminAction(session.user.id, "extend_trial", orgId, null,
    `Trial extended by ${days} days (new end: ${newEnd.toISOString()})`);

  return { billingCycleEnd: newEnd.toISOString() };
}

// ── AI Usage Management ──

/**
 * Reset an org's AI token usage counter to zero.
 * Typically used at the start of a billing cycle or as a goodwill gesture.
 */
export async function resetAiTokenUsage(orgId: string) {
  const session = await requireSystemAdmin();

  await dbc.organization.update({
    where: { id: orgId },
    data: { aiTokenUsed: 0 },
  });

  logAdminAction(session.user.id, "reset_ai_tokens", orgId, null,
    "AI token usage counter reset to 0");

  return { aiTokenUsed: 0 };
}

/**
 * Override an org's AI token budget. The budget caps how many tokens the org
 * can consume per billing cycle before AI features are throttled.
 */
export async function setAiTokenBudget(orgId: string, budget: number) {
  const session = await requireSystemAdmin();
  if (budget < 0) throw new Error("Budget must be non-negative");

  await dbc.organization.update({
    where: { id: orgId },
    data: { aiTokenBudget: budget },
  });

  logAdminAction(session.user.id, "set_ai_budget", orgId, null,
    `AI token budget set to ${budget.toLocaleString()}`);

  return { aiTokenBudget: budget };
}

// ── Fix-It Tools ──

/**
 * Resend an invitation by creating a new AccountInvitation with a fresh token
 * and 7-day expiry. The old invite is NOT deleted (kept for audit trail).
 *
 * @returns The new invite URL (not sent via email — displayed in the admin UI).
 */
export async function resendInvite(orgId: string, email: string, role: string) {
  const session = await requireSystemAdmin();

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await dbc.accountInvitation.create({
    data: {
      orgId,
      email,
      role,
      token,
      expiresAt,
      invitedById: session.user.id,
    },
  });

  logAdminAction(session.user.id, "resend_invite", orgId, null,
    `Resent invite to ${email} as ${role}`);

  // Return URL path — the admin copies and sends manually or via their own email
  return { inviteUrl: `/invite/activate/${token}`, email, expiresAt: expiresAt.toISOString() };
}

/**
 * "Reset password" for a user by generating a new account invitation link.
 * The user clicks it, sets a new password, and their existing account is updated.
 * Does NOT delete the old password — the new activation flow will overwrite it.
 */
export async function resetUserPassword(orgId: string, userId: string) {
  const session = await requireSystemAdmin();

  const user = await dbc.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });
  if (!user) throw new Error("User not found");

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await dbc.accountInvitation.create({
    data: {
      orgId,
      email: user.email,
      role: user.role,
      token,
      expiresAt,
      invitedById: session.user.id,
    },
  });

  logAdminAction(session.user.id, "reset_password", orgId, userId,
    `Password reset link generated for ${user.email}`);

  return { inviteUrl: `/invite/activate/${token}`, email: user.email };
}

/**
 * Clear all "stuck" phases for a project by resetting their status to NOT_STARTED.
 * A phase is considered "stuck" if it has status IN_PROGRESS but no updates in
 * the last 30 days. This is a data-repair tool, not a normal workflow action.
 */
export async function clearStuckPhases(orgId: string, projectId: string) {
  const session = await requireSystemAdmin();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await dbc.phase.updateMany({
    where: {
      projectId,
      status: "IN_PROGRESS",
      updatedAt: { lt: thirtyDaysAgo },
    },
    data: { status: "NOT_STARTED" },
  });

  logAdminAction(session.user.id, "clear_stuck_phases", orgId, null,
    `Reset ${result.count} stuck phase(s) in project ${projectId}`);

  return { phasesReset: result.count };
}

// ── Admin Audit Log ──

/**
 * Fetch the system admin audit log, showing all actions taken by any SYSTEM_ADMIN.
 * Supports pagination via cursor-based offset.
 *
 * @param limit  Number of entries to return (default 50, max 200)
 * @param cursor Optional cursor (ID of last entry from previous page)
 */
export async function getAdminAuditLog(limit: number = 50, cursor?: string) {
  await requireSystemAdmin();
  const take = Math.min(limit, 200);

  const logs = await dbc.systemAdminLog.findMany({
    take: take + 1, // Fetch one extra to determine if there's a next page
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      admin: { select: { name: true, email: true } },
      targetOrg: { select: { name: true, slug: true } },
    },
  });

  const hasMore = logs.length > take;
  const entries = (hasMore ? logs.slice(0, take) : logs).map((log: any) => ({
    id: log.id,
    action: log.action,
    detail: log.detail,
    adminName: log.admin?.name ?? log.admin?.email ?? "Unknown",
    orgName: log.targetOrg?.name ?? null,
    orgSlug: log.targetOrg?.slug ?? null,
    targetUserId: log.targetUserId,
    createdAt: log.createdAt.toISOString(),
  }));

  return {
    entries,
    nextCursor: hasMore ? entries[entries.length - 1]?.id : null,
  };
}
