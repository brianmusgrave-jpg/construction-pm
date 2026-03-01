"use server";

/**
 * @file src/actions/ai-quota.ts
 * @description Server actions for AI quota management (Sprint 16).
 *
 * Exposes getOrgAIBudgetStatus() for client components to fetch
 * current AI budget/plan status for UI gating and warnings.
 */

import { auth } from "@/lib/auth";
import { getAIBudgetStatus, type AIBudgetStatus } from "@/lib/ai-quota";
import { db } from "@/lib/db";

const dbc = db as any;

/**
 * Get AI budget status for the current user's org.
 * Returns plan, usage ratio, and gating flags.
 */
export async function getOrgAIBudgetStatus(): Promise<AIBudgetStatus | null> {
  const session = await auth();
  if (!session?.user) return null;

  const orgId = (session.user as any).orgId;
  if (!orgId) return null;

  return getAIBudgetStatus(orgId);
}

/**
 * Reset AI token usage for an org (System Admin only).
 * Called from the System Admin panel to reset an org's monthly counter.
 */
export async function resetOrgAITokenUsage(orgId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const user = await dbc.user.findUnique({ where: { id: session.user.id } });
  if (!user || (user.role !== "SYSTEM_ADMIN" && user.role !== "ADMIN")) {
    throw new Error("Forbidden: Only admins can reset AI usage");
  }

  await dbc.organization.update({
    where: { id: orgId },
    data: { aiTokenUsed: 0 },
  });
}

/**
 * Update AI token budget for an org (System Admin only).
 */
export async function updateOrgAIBudget(
  orgId: string,
  newBudget: number
): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const user = await dbc.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "SYSTEM_ADMIN") {
    throw new Error("Forbidden: Only system admins can update AI budgets");
  }

  await dbc.organization.update({
    where: { id: orgId },
    data: { aiTokenBudget: newBudget },
  });
}
