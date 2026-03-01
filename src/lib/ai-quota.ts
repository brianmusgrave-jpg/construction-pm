/**
 * @file src/lib/ai-quota.ts
 * @description AI feature gating and token tracking (Sprint 16).
 *
 * checkAIQuota()   — verifies org plan allows AI and budget isn't exceeded.
 * trackAITokenUsage() — increments org.aiTokenUsed after each AI call.
 * getAIBudgetStatus() — returns current usage ratio for UI warnings.
 */

import { db } from "@/lib/db";

const dbc = db as any;

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface AIBudgetStatus {
  plan: string;
  aiTokenBudget: number;
  aiTokenUsed: number;
  usageRatio: number;     // 0.0 – 1.0+
  isOverBudget: boolean;
  isNearLimit: boolean;   // > 90%
  aiAllowed: boolean;     // STARTER = false
}

/* ------------------------------------------------------------------ */
/*  Quota check — call BEFORE every AI request                         */
/* ------------------------------------------------------------------ */

/**
 * Verify the org's plan and token budget allow an AI call.
 *
 * @throws "AI features require a Pro or Enterprise plan" for STARTER orgs
 * @throws "AI token budget exceeded for this billing cycle" when over budget
 */
export async function checkAIQuota(orgId: string): Promise<void> {
  const org = await dbc.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, aiTokenBudget: true, aiTokenUsed: true },
  });

  if (!org) throw new Error("Organization not found");

  if (org.plan === "STARTER") {
    throw new Error("AI features require a Pro or Enterprise plan");
  }

  if (org.aiTokenUsed >= org.aiTokenBudget) {
    throw new Error("AI token budget exceeded for this billing cycle");
  }
}

/* ------------------------------------------------------------------ */
/*  Token tracking — call AFTER every successful AI call               */
/* ------------------------------------------------------------------ */

/**
 * Increment the org's aiTokenUsed counter.
 * Fire-and-forget — callers should `.catch(() => {})`.
 */
export async function trackAITokenUsage(
  orgId: string,
  tokensUsed: number
): Promise<void> {
  try {
    await dbc.organization.update({
      where: { id: orgId },
      data: { aiTokenUsed: { increment: tokensUsed } },
    });
  } catch (err) {
    console.warn("[ai-quota] Failed to track token usage:", err);
  }
}

/* ------------------------------------------------------------------ */
/*  Budget status — used by UI for warnings and lock icons             */
/* ------------------------------------------------------------------ */

/**
 * Get AI budget status for the current org.
 * Returns plan info, usage ratio, and whether AI is allowed.
 */
export async function getAIBudgetStatus(orgId: string): Promise<AIBudgetStatus> {
  const org = await dbc.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, aiTokenBudget: true, aiTokenUsed: true },
  });

  if (!org) {
    return {
      plan: "STARTER",
      aiTokenBudget: 0,
      aiTokenUsed: 0,
      usageRatio: 0,
      isOverBudget: false,
      isNearLimit: false,
      aiAllowed: false,
    };
  }

  const aiAllowed = org.plan !== "STARTER";
  const usageRatio = org.aiTokenBudget > 0
    ? org.aiTokenUsed / org.aiTokenBudget
    : 0;

  return {
    plan: org.plan,
    aiTokenBudget: org.aiTokenBudget,
    aiTokenUsed: org.aiTokenUsed,
    usageRatio,
    isOverBudget: org.aiTokenUsed >= org.aiTokenBudget,
    isNearLimit: usageRatio > 0.9 && usageRatio < 1,
    aiAllowed,
  };
}
