"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// AnalyticsData type moved to @/lib/analytics-types to avoid "use server" export restriction
import type { AnalyticsData, AnalyticsDateRange } from "@/lib/analytics-types";
export type { AnalyticsData, AnalyticsDateRange } from "@/lib/analytics-types";

export async function getAnalytics(range: AnalyticsDateRange = "6m"): Promise<AnalyticsData> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  // Get accessible project IDs
  const memberships = await db.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  const projectIds = memberships.map((m: { projectId: string }) => m.projectId);

  // Date range filter
  const rangeMonths = range === "3m" ? 3 : range === "6m" ? 6 : range === "12m" ? 12 : 120;
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - rangeMonths);

  // Project status distribution
  const projects = await db.project.findMany({
    where: { id: { in: projectIds } },
    select: {
      id: true,
      status: true,
      name: true,
      budget: true,
      phases: { select: { actualCost: true } },
    },
  });
  const projectStatusMap = new Map<string, number>();
  for (const p of projects) {
    projectStatusMap.set(p.status, (projectStatusMap.get(p.status) ?? 0) + 1);
  }
  const projectStatusCounts = Array.from(projectStatusMap.entries()).map(
    ([status, count]) => ({ status, count })
  );

  // Per-project budget breakdown (amountSpent derived from phase actualCost sums)
  type ProjectWithPhases = (typeof projects)[number];
  const projectBudgets = projects
    .filter((p: ProjectWithPhases) => Number(p.budget ?? 0) > 0)
    .map((p: ProjectWithPhases) => {
      const spent = (p.phases ?? []).reduce(
        (sum: number, ph: { actualCost: number | null }) => sum + Number(ph.actualCost ?? 0),
        0
      );
      return {
        name: p.name.length > 20 ? p.name.slice(0, 20) + "…" : p.name,
        estimated: Number(p.budget ?? 0),
        actual: spent,
      };
    })
    .sort((a: { estimated: number }, b: { estimated: number }) => b.estimated - a.estimated)
    .slice(0, 8);

  // Phase status distribution + budget totals
  const phases = await db.phase.findMany({
    where: { projectId: { in: projectIds } },
    select: { status: true, estimatedCost: true, actualCost: true, createdAt: true },
  });
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

  // Team workload: top 8 staff by assignment count
  const assignments = await db.phaseAssignment.findMany({
    where: { phase: { projectId: { in: projectIds } } },
    select: { staff: { select: { name: true } } },
  });
  const workloadMap = new Map<string, number>();
  for (const a of assignments) {
    const name = a.staff.name;
    workloadMap.set(name, (workloadMap.get(name) ?? 0) + 1);
  }
  const teamWorkload = Array.from(workloadMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, assignedPhases]) => ({ name, assignedPhases }));

  // Monthly activity: last N months
  const recentPhases = await db.phase.findMany({
    where: {
      projectId: { in: projectIds },
      createdAt: { gte: rangeStart },
    },
    select: { createdAt: true },
  });
  const recentDocs = await db.document.findMany({
    where: {
      phase: { projectId: { in: projectIds } },
      createdAt: { gte: rangeStart },
    },
    select: { createdAt: true },
  });

  const monthlyMap = new Map<string, { phases: number; documents: number }>();
  const getMonthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

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

  // Phase completion trend: last 8 weeks
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  const completedPhases = await db.phase.findMany({
    where: {
      projectId: { in: projectIds },
      status: "COMPLETE",
      updatedAt: { gte: eightWeeksAgo },
    },
    select: { updatedAt: true },
  });
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

  // Budget S-curve: cumulative planned vs actual over time
  // Distribute estimated cost evenly across project months, accumulate actual by phase creation
  const budgetCurveMap = new Map<string, { planned: number; actual: number }>();
  const curveMonths = Math.min(rangeMonths, 12);
  for (let i = curveMonths - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    budgetCurveMap.set(getMonthKey(d), { planned: 0, actual: 0 });
  }

  // Spread estimated cost evenly across months (simple linear plan)
  const monthKeys = Array.from(budgetCurveMap.keys());
  const monthlyPlanned = totalEstimated / Math.max(monthKeys.length, 1);
  let cumulativePlanned = 0;
  let cumulativeActual = 0;

  // Accumulate actual costs by phase creation date
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
