"use server";

/**
 * @file actions/analytics.ts
 * @description Server action for the analytics dashboard data aggregation.
 *
 * `getAnalytics` runs all DB queries in parallel and assembles the full
 * `AnalyticsData` payload consumed by the AnalyticsWidgets component.
 *
 * Data is scoped to the current user's accessible projects (via ProjectMember).
 * A viewer with no memberships will receive empty/zero data rather than an error.
 *
 * Date range options: "3m" | "6m" | "12m" | "all" (all = 10-year window)
 *
 * Computed datasets returned:
 *   - projectStatusCounts:   distribution of projects by status
 *   - phaseStatusCounts:     distribution of phases by status
 *   - budgetSummary:         total estimated vs actual cost across all phases
 *   - monthlyActivity:       phase and document creation counts per calendar month
 *   - teamWorkload:          top-8 staff members by phase assignment count
 *   - phaseCompletionTrend:  completed phases per week over the last 8 weeks
 *   - budgetCurve:           cumulative planned vs actual cost (S-curve)
 *   - projectBudgets:        per-project budget vs actual (top 8 by budget size)
 *
 * Type note: `AnalyticsData` and `AnalyticsDateRange` are defined in
 * `@/lib/analytics-types` to work around the "use server" export restriction.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Types live in lib/ to satisfy the "use server" export restriction
import type { AnalyticsData, AnalyticsDateRange } from "@/lib/analytics-types";
export type { AnalyticsData, AnalyticsDateRange } from "@/lib/analytics-types";

/**
 * Fetch and aggregate all analytics data for the current user's projects.
 *
 * @param range - Time window for monthly activity and trend charts.
 *   "3m" = 3 months, "6m" = 6 months (default), "12m" = 1 year, "all" = all time.
 *
 * Requires: authenticated session.
 */
export async function getAnalytics(range: AnalyticsDateRange = "6m"): Promise<AnalyticsData> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  // Scope all queries to projects the user is a member of
  const memberships = await db.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  const projectIds = memberships.map((m: { projectId: string }) => m.projectId);

  // Convert range string to integer months; "all" uses 120 months (10 years)
  const rangeMonths = range === "3m" ? 3 : range === "6m" ? 6 : range === "12m" ? 12 : 120;
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - rangeMonths);
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  // ── Batch all independent DB queries via Promise.all ──
  const [projects, phases, assignments, recentPhases, recentDocs, completedPhases] =
    await Promise.all([
      // Project status distribution + per-project budgets and actual spend
      db.project.findMany({
        where: { id: { in: projectIds } },
        select: {
          id: true,
          status: true,
          name: true,
          budget: true,
          phases: { select: { actualCost: true } },
        },
      }),
      // Phase status distribution + budget totals across all phases
      db.phase.findMany({
        where: { projectId: { in: projectIds } },
        select: { status: true, estimatedCost: true, actualCost: true, createdAt: true },
      }),
      // Team workload: all phase assignments for staff name lookup
      db.phaseAssignment.findMany({
        where: { phase: { projectId: { in: projectIds } } },
        select: { staff: { select: { name: true } } },
      }),
      // Monthly activity: phases created within the selected range
      db.phase.findMany({
        where: {
          projectId: { in: projectIds },
          createdAt: { gte: rangeStart },
        },
        select: { createdAt: true },
      }),
      // Monthly activity: documents uploaded within the selected range
      db.document.findMany({
        where: {
          phase: { projectId: { in: projectIds } },
          createdAt: { gte: rangeStart },
        },
        select: { createdAt: true },
      }),
      // Phase completion trend: completed phases in the last 8 weeks
      db.phase.findMany({
        where: {
          projectId: { in: projectIds },
          status: "COMPLETE",
          updatedAt: { gte: eightWeeksAgo },
        },
        select: { updatedAt: true },
      }),
    ]);

  // ── Aggregate: project status distribution ──
  const projectStatusMap = new Map<string, number>();
  for (const p of projects) {
    projectStatusMap.set(p.status, (projectStatusMap.get(p.status) ?? 0) + 1);
  }
  const projectStatusCounts = Array.from(projectStatusMap.entries()).map(
    ([status, count]) => ({ status, count })
  );

  // ── Aggregate: per-project budget breakdown (top 8 by budget size) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectBudgets = (projects as any[])
    .filter((p) => Number(p.budget ?? 0) > 0)
    .map((p) => {
      const spent = (p.phases ?? []).reduce(
        (sum: number, ph: { actualCost: unknown }) => sum + Number(ph.actualCost ?? 0),
        0
      );
      return {
        // Truncate long names to fit chart labels
        name: (p.name as string).length > 20 ? (p.name as string).slice(0, 20) + "…" : (p.name as string),
        estimated: Number(p.budget ?? 0),
        actual: spent as number,
      };
    })
    .sort((a: { estimated: number }, b: { estimated: number }) => b.estimated - a.estimated)
    .slice(0, 8);

  // ── Aggregate: phase status distribution + budget totals ──
  const phaseStatusMap = new Map<string, number>();
  let totalEstimated = 0;
  let totalActual = 0;
  for (const ph of phases) {
    phaseStatusMap.set(ph.status, (phaseStatusMap.get(ph.status) ?? 0) + 1);
    totalEstimated += Number(ph.estimatedCost ?? 0);
    totalActual += Number(ph.actualCost ?? 0);
  }
  const phaseStatusCounts = Array.from(phaseStatusMap.entries()).map(
    ([status, count]) => ({ status, count })
  );

  // ── Aggregate: team workload (top 8 by assignment count) ──
  const workloadMap = new Map<string, number>();
  for (const a of assignments) {
    const name = a.staff.name;
    workloadMap.set(name, (workloadMap.get(name) ?? 0) + 1);
  }
  const teamWorkload = Array.from(workloadMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, assignedPhases]) => ({ name, assignedPhases }));

  // ── Aggregate: monthly activity (phases + docs created per month) ──
  const monthlyMap = new Map<string, { phases: number; documents: number }>();
  const getMonthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  // Pre-populate all months in range (ensures zero-count months appear in chart)
  for (let i = rangeMonths - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    monthlyMap.set(getMonthKey(d), { phases: 0, documents: 0 });
  }
  for (const ph of recentPhases) {
    const key = getMonthKey(new Date(ph.createdAt));
    if (monthlyMap.has(key)) monthlyMap.get(key)!.phases++;
  }
  for (const doc of recentDocs) {
    const key = getMonthKey(new Date(doc.createdAt));
    if (monthlyMap.has(key)) monthlyMap.get(key)!.documents++;
  }
  const monthlyActivity = Array.from(monthlyMap.entries()).map(
    ([month, data]) => ({ month, ...data })
  );

  // ── Aggregate: phase completion trend (completed phases per week, last 8 weeks) ──
  const weekMap = new Map<string, number>();
  for (let i = 7; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    const wk = `W${String(d.getDate()).padStart(2, "0")}/${d.getMonth() + 1}`;
    weekMap.set(wk, 0);
  }
  for (const ph of completedPhases) {
    const d = new Date(ph.updatedAt);
    const wk = `W${String(d.getDate()).padStart(2, "0")}/${d.getMonth() + 1}`;
    if (weekMap.has(wk)) weekMap.set(wk, (weekMap.get(wk) ?? 0) + 1);
  }
  const phaseCompletionTrend = Array.from(weekMap.entries()).map(
    ([week, completed]) => ({ week, completed })
  );

  // ── Aggregate: budget S-curve (cumulative planned vs actual over time) ──
  // Strategy: distribute estimated cost linearly across months (simple plan),
  // accumulate actual costs by the month each phase was created.
  const budgetCurveMap = new Map<string, { planned: number; actual: number }>();
  const curveMonths = Math.min(rangeMonths, 12);
  for (let i = curveMonths - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    budgetCurveMap.set(getMonthKey(d), { planned: 0, actual: 0 });
  }

  const monthKeys = Array.from(budgetCurveMap.keys());
  const monthlyPlanned = totalEstimated / Math.max(monthKeys.length, 1); // Linear spread
  let cumulativePlanned = 0;
  let cumulativeActual = 0;

  // Map actual costs to the month the phase was created
  const actualByMonth = new Map<string, number>();
  for (const ph of phases) {
    const key = getMonthKey(new Date(ph.createdAt));
    actualByMonth.set(key, (actualByMonth.get(key) ?? 0) + Number(ph.actualCost ?? 0));
  }

  const budgetCurve: { month: string; planned: number; actual: number }[] = [];
  for (const mk of monthKeys) {
    cumulativePlanned += monthlyPlanned;
    cumulativeActual += actualByMonth.get(mk) ?? 0;
    budgetCurve.push({
      month: mk,
      planned: Math.round(cumulativePlanned),
      actual: Math.round(cumulativeActual),
    });
  }

  return {
    projectStatusCounts,
    phaseStatusCounts,
    budgetSummary: { totalEstimated, totalActual },
    monthlyActivity,
    teamWorkload,
    phaseCompletionTrend,
    budgetCurve,
    projectBudgets,
  };
}
