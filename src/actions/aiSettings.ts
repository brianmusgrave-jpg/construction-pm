"use server";
/**
 * @file src/actions/aiSettings.ts
 * @description Server actions for AI settings management and usage tracking.
 *
 * Provides two tiers of functions:
 *   - Internal helpers (used by src/lib/ai.ts via dynamic import):
 *       getAISettingsInternal(), logAIUsageInternal()
 *   - Public server actions (used by UI components):
 *       getAISettings(), updateAISettings(), getAIUsage(), getAIUsageSummary()
 *
 * Internal helpers avoid importing from this file at the module level inside
 * src/lib/ai.ts to prevent circular dependencies. They are called via
 * `await import("@/actions/aiSettings")` at runtime inside callAI().
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const dbc = db as any;

// ── Types ──────────────────────────────────────────────────────────────────

/** Serialised AI settings safe to pass to client components. */
export interface AISettingsData {
  id: string;
  provider: "OPENAI" | "ANTHROPIC";
  model: string;
  maxTokens: number;
  dailyBudgetUsd: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Aggregated per-day usage for display in the admin panel. */
export interface AIUsageDay {
  date: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  calls: number;
}

/** Summary stats for AI usage over a time window. */
export interface AIUsageSummary {
  totalCostUsd: number;
  totalTokens: number;
  totalCalls: number;
  successRate: number;
  byDay: AIUsageDay[];
}

// ── Internal helpers (called by src/lib/ai.ts via dynamic import) ──────────

/**
 * Retrieve the current AI settings row (or sensible defaults if none exists).
 *
 * Returns a plain object — safe for serialisation across the import boundary.
 * Called internally by callAI() to read provider, model, budget, and enabled flag.
 *
 * @returns Current AI settings as a plain object
 */
export async function getAISettingsInternal(): Promise<{
  provider: string;
  model: string;
  maxTokens: number;
  dailyBudgetUsd: number;
  enabled: boolean;
}> {
  const row = await dbc.aISettings.findFirst({
    orderBy: { createdAt: "asc" },
  });

  return {
    provider: row?.provider ?? "OPENAI",
    model: row?.model ?? "gpt-4o-mini",
    maxTokens: row?.maxTokens ?? 2000,
    dailyBudgetUsd: row?.dailyBudgetUsd ?? 10.0,
    enabled: row?.enabled ?? false,
  };
}

/**
 * Persist an AI usage log entry.
 *
 * Called fire-and-forget (without await) from callAI() so callers are
 * never blocked by a DB write. Failures are logged but swallowed.
 *
 * Accepts a single options object for ergonomics and to match the call
 * site in src/lib/ai.ts.
 */
export async function logAIUsageInternal(opts: {
  userId: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  feature: string;
  success: boolean;
}): Promise<void> {
  try {
    await dbc.aIUsageLog.create({
      data: {
        userId: opts.userId,
        provider: opts.provider,
        model: opts.model,
        promptTokens: opts.promptTokens,
        completionTokens: opts.completionTokens,
        totalTokens: opts.totalTokens,
        costUsd: opts.costUsd,
        feature: opts.feature,
        success: opts.success,
      },
    });
  } catch (err) {
    console.warn("[aiSettings] Failed to log AI usage:", err);
  }
}

// ── Public server actions ──────────────────────────────────────────────────

/**
 * Fetch the current AI settings for the admin panel.
 * Creates a default row if none exists.
 *
 * @returns Serialised AI settings data
 * @throws If the caller is not authenticated as ADMIN
 */
export async function getAISettings(): Promise<AISettingsData> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const user = await dbc.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "ADMIN") throw new Error("Forbidden");

  // Upsert: create a default row if the table is empty
  let row = await dbc.aISettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (!row) {
    row = await dbc.aISettings.create({
      data: {
        provider: "OPENAI",
        model: "gpt-4o-mini",
        maxTokens: 2000,
        dailyBudgetUsd: 10.0,
        enabled: false,
      },
    });
  }

  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    maxTokens: row.maxTokens,
    dailyBudgetUsd: row.dailyBudgetUsd,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Update AI settings (admin-only).
 *
 * Validates the caller is an ADMIN before applying changes.
 * Revalidates `/dashboard/admin` so the panel reflects the new values.
 *
 * @param id     - The settings row ID to update
 * @param update - Partial settings object with fields to change
 * @throws If the caller is not authenticated as ADMIN
 */
export async function updateAISettings(
  id: string,
  update: {
    provider?: "OPENAI" | "ANTHROPIC";
    model?: string;
    maxTokens?: number;
    dailyBudgetUsd?: number;
    enabled?: boolean;
  }
): Promise<AISettingsData> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const user = await dbc.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "ADMIN") throw new Error("Forbidden");

  const row = await dbc.aISettings.update({
    where: { id },
    data: update,
  });

  revalidatePath("/dashboard/admin");

  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    maxTokens: row.maxTokens,
    dailyBudgetUsd: row.dailyBudgetUsd,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Retrieve aggregated AI usage statistics for the admin panel.
 *
 * Returns per-day usage for the last `days` calendar days, plus overall
 * totals for easy display in summary cards.
 *
 * @param days - How many days of history to include (default: 7)
 * @returns Usage summary with daily breakdown
 * @throws If the caller is not authenticated as ADMIN
 */
export async function getAIUsageSummary(days = 7): Promise<AIUsageSummary> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const user = await dbc.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "ADMIN") throw new Error("Forbidden");

  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs: Array<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    success: boolean;
    createdAt: Date;
  }> = await dbc.aIUsageLog.findMany({
    where: { createdAt: { gte: since } },
    select: {
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      costUsd: true,
      success: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Aggregate totals
  let totalCostUsd = 0;
  let totalTokens = 0;
  let totalCalls = 0;
  let successCount = 0;

  // Group by calendar date (YYYY-MM-DD in UTC)
  const byDayMap = new Map<
    string,
    { promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number; calls: number }
  >();

  for (const log of logs) {
    totalCostUsd += log.costUsd;
    totalTokens += log.totalTokens;
    totalCalls += 1;
    if (log.success) successCount += 1;

    const dateKey = log.createdAt.toISOString().slice(0, 10);
    const existing = byDayMap.get(dateKey) ?? {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      calls: 0,
    };
    byDayMap.set(dateKey, {
      promptTokens: existing.promptTokens + log.promptTokens,
      completionTokens: existing.completionTokens + log.completionTokens,
      totalTokens: existing.totalTokens + log.totalTokens,
      costUsd: existing.costUsd + log.costUsd,
      calls: existing.calls + 1,
    });
  }

  const byDay: AIUsageDay[] = Array.from(byDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, ...stats }));

  return {
    totalCostUsd,
    totalTokens,
    totalCalls,
    successRate: totalCalls > 0 ? successCount / totalCalls : 1,
    byDay,
  };
}
