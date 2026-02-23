"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export interface AnalyticsData {
  projectStatusCounts: { status: string; count: number }[];
  phaseStatusCounts: { status: string; count: number }[];
  budgetSummary: { totalEstimated: number; totalActual: number };
  monthlyActivity: { month: string; phases: number; documents: number }[];
  teamWorkload: { name: string; assignedPhases: number }[];
  phaseCompletionTrend: { week: string; completed: number }[];
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  // Get accessible project IDs
  const memberships = await db.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  const projectIds = memberships.map((m: { projectId: string }) => m.projectId);

  // Project status distribution
  const projects = await db.project.findMany({
    where: { id: { in: projectIds } },
    select: { status: true },
  });
  const projectStatusMap = new Map<string, number>();
  for (const p of projects) {
    projectStatusMap.set(p.status, (projectStatusMap.get(p.status) ?? 0) + 1);
  }
  const projectStatusCounts = Array.from(projectStatusMap.entries()).map(
    ([status, count]) => ({ status, count })
  );

  // Phase status distribution
  const phases = await db.phase.findMany({
    where: { projectId: { in: projectIds } },
    select: { status: true, estimatedCost: true, actualCost: true },
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

  // Monthly activity: last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentPhases = await db.phase.findMany({
    where: {
      projectId: { in: projectIds },
      createdAt: { gte: sixMonthsAgo },
    },
    select: { createdAt: true },
  });
  const recentDocs = await db.document.findMany({
    where: {
      phase: { projectId: { in: projectIds } },
      createdAt: { gte: sixMonthsAgo },
    },
    select: { createdAt: true },
  });

  const monthlyMap = new Map<string, { phases: number; documents: number }>();
  const getMonthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  for (let i = 5; i >= 0; i--) {
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

  return {
    projectStatusCounts,
    phaseStatusCounts,
    budgetSummary: { totalEstimated, totalActual },
    monthlyActivity,
    teamWorkload,
    phaseCompletionTrend,
  };
}
