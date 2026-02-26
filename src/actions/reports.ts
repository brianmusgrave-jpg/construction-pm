"use server";

/**
 * @file actions/reports.ts
 * @description Server actions powering the Reports dashboard and contractor performance views.
 *
 * This file contains two groups of reports:
 *
 * Admin / PM Reports — aggregated across all projects the user is a member of:
 *   - `getProjectHealthReport`   — per-project progress, phase counts, schedule health
 *   - `getPhaseStatusBreakdown`  — global count by phase status (for pie chart)
 *   - `getDocumentStats`         — totals by DocStatus and DocCategory
 *   - `getActivityTimeline`      — daily activity counts + breakdown by action type
 *   - `getTeamPerformance`       — per-staff assignment stats (completed, active, overdue)
 *   - `getOverdueReport`         — phases past estEnd, not yet COMPLETE
 *   - `getJobPLReport`           — per-project P&L: budget vs actual vs change orders
 *   - `exportJobPLCsv`           — CSV export of the Job P&L data
 *
 * Contractor Reports — scoped to the current user's assigned work:
 *   - `getContractorPerformance` — merged view of member phases + staff-matched phases
 *
 * Key types:
 *   `JobPLRow` — exported interface for the P&L report row shape; lives here because
 *   this is not a `"use server"` restriction violation (it IS in the actions file and
 *   exported types are allowed when the file has async exports). Consuming components
 *   should import it from here.
 *
 * Decimal coercion:
 *   All Prisma `Decimal` fields (budget, estimatedCost, actualCost, amount) are
 *   coerced with `Number()` before being returned — Decimal objects are not
 *   serialisable across the server/client boundary.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ── Admin / PM Reports ──

/**
 * Compute a health summary for every project the current user is a member of.
 *
 * Health classification:
 *   - "at-risk"     — any phase is overdue (past estEnd, not COMPLETE)
 *   - "on-track"    — no overdue phases, at least one active phase
 *   - "not-started" — no active or overdue phases
 *
 * @returns Array of project summary objects ordered by most recently updated.
 */
export async function getProjectHealthReport() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const projects = await db.project.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
      phases: {
        select: {
          id: true,
          name: true,
          status: true,
          progress: true,
          estStart: true,
          estEnd: true,
          actualStart: true,
          actualEnd: true,
          isMilestone: true,
        },
      },
      _count: { select: { phases: true, members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const now = new Date();

  return projects.map((project: typeof projects[number]) => {
    const phases = project.phases;
    const completed = phases.filter((p: typeof phases[number]) => p.status === "COMPLETE").length;
    const active = phases.filter(
      (p: typeof phases[number]) =>
        p.status === "IN_PROGRESS" ||
        p.status === "REVIEW_REQUESTED" ||
        p.status === "UNDER_REVIEW"
    ).length;
    const overdue = phases.filter(
      (p: typeof phases[number]) => p.status !== "COMPLETE" && new Date(p.estEnd) < now
    ).length;
    const pending = phases.filter((p: typeof phases[number]) => p.status === "PENDING").length;
    const total = phases.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // "at-risk" takes precedence; "not-started" when no phases are moving
    const health =
      overdue > 0 ? "at-risk" : active > 0 ? "on-track" : "not-started";

    return {
      id: project.id,
      name: project.name,
      address: project.address,
      status: project.status,
      budget: project.budget ? Number(project.budget) : null, // Decimal → number
      estCompletion: project.estCompletion,
      memberCount: project._count.members,
      phases: { total, completed, active, overdue, pending },
      progress,
      health,
    };
  });
}

/**
 * Return a global count of phases grouped by status.
 * Scoped to projects the current user is a member of.
 * Pre-initialises all 5 status keys to 0 so the chart always has a full dataset.
 *
 * @returns Array of `{ status, count }` objects for all 5 phase statuses.
 */
export async function getPhaseStatusBreakdown() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const phases = await db.phase.findMany({
    where: { project: { members: { some: { userId: session.user.id } } } },
    select: { status: true },
  });

  // Pre-fill all statuses with 0 so the pie chart renders even if some are empty
  const counts: Record<string, number> = {
    PENDING: 0,
    IN_PROGRESS: 0,
    REVIEW_REQUESTED: 0,
    UNDER_REVIEW: 0,
    COMPLETE: 0,
  };
  phases.forEach((p: typeof phases[number]) => {
    counts[p.status] = (counts[p.status] || 0) + 1;
  });

  return Object.entries(counts).map(([status, count]: [string, number]) => ({
    status,
    count,
  }));
}

/**
 * Return document totals by status and category.
 * Scoped to phases in projects the current user is a member of.
 * Uses parallel `groupBy` queries for efficiency.
 *
 * @returns `{ total, byStatus[], byCategory[] }`
 */
export async function getDocumentStats() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const where = {
    phase: {
      project: { members: { some: { userId: session.user.id } } },
    },
  };

  const [total, byStatus, byCategory] = await Promise.all([
    db.document.count({ where }),
    db.document.groupBy({ by: ["status"], where, _count: true }),
    db.document.groupBy({ by: ["category"], where, _count: true }),
  ]);

  return {
    total,
    byStatus: byStatus.map((s: typeof byStatus[number]) => ({ status: s.status, count: s._count })),
    byCategory: byCategory.map((c: typeof byCategory[number]) => ({
      category: c.category,
      count: c._count,
    })),
  };
}

/**
 * Aggregate activity log events into a daily histogram and action-type breakdown.
 * Useful for a "team activity over time" sparkline chart.
 *
 * @param days - Look-back window in days (default 30).
 * @returns `{ daily[], byAction[], totalActions }` — daily sorted ascending by date;
 *   byAction sorted descending by count.
 */
export async function getActivityTimeline(days: number = 30) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const since = new Date();
  since.setDate(since.getDate() - days);

  const activity = await db.activityLog.findMany({
    where: {
      project: { members: { some: { userId: session.user.id } } },
      createdAt: { gte: since },
    },
    select: { action: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Group raw log entries into daily buckets (ISO date string as key)
  const dailyCounts: Record<string, number> = {};
  activity.forEach((a: typeof activity[number]) => {
    const day = a.createdAt.toISOString().split("T")[0];
    dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  });

  // Count occurrences of each action type for the breakdown bar chart
  const actionCounts: Record<string, number> = {};
  activity.forEach((a: typeof activity[number]) => {
    actionCounts[a.action] = (actionCounts[a.action] || 0) + 1;
  });

  return {
    daily: Object.entries(dailyCounts).map(([date, count]: [string, number]) => ({
      date,
      count,
    })),
    byAction: Object.entries(actionCounts)
      .map(([action, count]: [string, number]) => ({ action, count }))
      .sort((a: { action: string; count: number }, b: { action: string; count: number }) => b.count - a.count),
    totalActions: activity.length,
  };
}

/**
 * Per-staff member performance summary across all their phase assignments.
 * Filters to staff that have at least one assignment (unassigned staff omitted).
 *
 * @returns Array of staff performance objects, ordered alphabetically by name.
 */
export async function getTeamPerformance() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const staff = await db.staff.findMany({
    include: {
      assignments: {
        include: {
          phase: {
            select: {
              id: true,
              name: true,
              status: true,
              progress: true,
              estEnd: true,
              project: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();

  return staff
    .filter((s: typeof staff[number]) => s.assignments.length > 0) // Skip unassigned staff
    .map((s: typeof staff[number]) => {
      const phases = s.assignments.map((a: typeof s.assignments[number]) => a.phase);
      const completed = phases.filter((p: typeof phases[number]) => p.status === "COMPLETE").length;
      const active = phases.filter(
        (p: typeof phases[number]) =>
          p.status === "IN_PROGRESS" ||
          p.status === "REVIEW_REQUESTED" ||
          p.status === "UNDER_REVIEW"
      ).length;
      const overdue = phases.filter(
        (p: typeof phases[number]) => p.status !== "COMPLETE" && new Date(p.estEnd) < now
      ).length;

      return {
        id: s.id,
        name: s.name,
        company: s.company,
        role: s.role,
        contactType: s.contactType,
        totalAssignments: phases.length,
        completed,
        active,
        overdue,
        // How many phases this person is the primary owner (vs. supporting member)
        isOwnerCount: s.assignments.filter((a: typeof s.assignments[number]) => a.isOwner).length,
      };
    });
}

/**
 * Return all phases that are overdue (estEnd < now, status ≠ COMPLETE).
 * Scoped to projects the current user is a member of.
 * Includes the primary owner (isOwner=true assignment, up to 1) for accountability.
 *
 * @returns Array sorted by estEnd ascending (oldest overdue first).
 */
export async function getOverdueReport() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const now = new Date();

  const overduePhases = await db.phase.findMany({
    where: {
      project: { members: { some: { userId: session.user.id } } },
      status: { not: "COMPLETE" },
      estEnd: { lt: now },
    },
    include: {
      project: { select: { id: true, name: true } },
      assignments: {
        include: { staff: { select: { name: true, company: true } } },
        where: { isOwner: true },
        take: 1, // Only the primary owner
      },
    },
    orderBy: { estEnd: "asc" }, // Most overdue first
  });

  return overduePhases.map((p: typeof overduePhases[number]) => {
    const daysOver = Math.ceil(
      (now.getTime() - new Date(p.estEnd).getTime()) / 86400000
    );
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      projectId: p.project.id,
      projectName: p.project.name,
      estEnd: p.estEnd,
      daysOverdue: daysOver,
      progress: p.progress,
      owner: p.assignments[0]?.staff?.name || "Unassigned",
      ownerCompany: p.assignments[0]?.staff?.company || null,
    };
  });
}

// ── Job P&L Report ──

/**
 * Row shape for the Job Profit & Loss report.
 * Exported so consuming components can type-annotate report table rows.
 */
export interface JobPLRow {
  projectId: string;
  projectName: string;
  status: string;
  /** Original project budget (from project.budget). */
  budget: number;
  /** Sum of all phase estimatedCost values. */
  totalEstimatedCost: number;
  /** Sum of all phase actualCost values. */
  totalActualCost: number;
  /** Sum of all approved change order amounts across all phases. */
  changeOrderTotal: number;
  /** budget + changeOrderTotal — the revenue-adjusted contract value. */
  adjustedBudget: number;
  /** adjustedBudget - totalActualCost — gross profit before overhead. */
  grossProfit: number;
  /** grossProfit / adjustedBudget * 100 — percentage margin. */
  profitMargin: number;
  phaseCount: number;
  completedPhases: number;
}

/**
 * Build the Job P&L report for all active (non-archived) projects.
 * Aggregates budget, costs, and approved change orders into a single row per project.
 *
 * Note: Only approved change orders are included in `changeOrderTotal` —
 * pending/rejected COs have no financial impact until approved.
 * All Prisma Decimal values are coerced to Number before return.
 */
export async function getJobPLReport(): Promise<JobPLRow[]> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const projects = await db.project.findMany({
    where: { status: { not: "ARCHIVED" } },
    include: {
      phases: {
        select: {
          id: true,
          status: true,
          estimatedCost: true,
          actualCost: true,
          changeOrders: {
            where: { status: "APPROVED" }, // Only approved COs affect P&L
            select: { amount: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return projects.map((project: typeof projects[number]) => {
    const budget = Number(project.budget || 0);
    const totalEstimatedCost = project.phases.reduce(
      (sum: number, p: typeof project.phases[number]) => sum + Number(p.estimatedCost || 0),
      0
    );
    const totalActualCost = project.phases.reduce(
      (sum: number, p: typeof project.phases[number]) => sum + Number(p.actualCost || 0),
      0
    );
    const changeOrderTotal = project.phases.reduce(
      (sum: number, p: typeof project.phases[number]) =>
        sum + p.changeOrders.reduce((s: number, co: typeof p.changeOrders[number]) => s + Number(co.amount || 0), 0),
      0
    );
    const adjustedBudget = budget + changeOrderTotal;
    const grossProfit = adjustedBudget - totalActualCost;
    const profitMargin = adjustedBudget > 0 ? (grossProfit / adjustedBudget) * 100 : 0;
    const completedPhases = project.phases.filter((p: typeof project.phases[number]) => p.status === "COMPLETE").length;

    return {
      projectId: project.id,
      projectName: project.name,
      status: project.status,
      budget,
      totalEstimatedCost,
      totalActualCost,
      changeOrderTotal,
      adjustedBudget,
      grossProfit,
      profitMargin,
      phaseCount: project.phases.length,
      completedPhases,
    };
  });
}

/**
 * Export the Job P&L report as a CSV string.
 * All string values are double-quote escaped to handle names containing commas.
 *
 * @returns A UTF-8 CSV string ready to be written to a Blob or Response.
 */
export async function exportJobPLCsv(): Promise<string> {
  const rows = await getJobPLReport();

  const header =
    "Project,Status,Budget,Estimated Cost,Actual Cost,Change Orders,Adjusted Budget,Gross Profit,Profit Margin %,Phases,Completed";
  const csvRows = rows.map((r: JobPLRow) =>
    [
      r.projectName,
      r.status,
      r.budget.toFixed(2),
      r.totalEstimatedCost.toFixed(2),
      r.totalActualCost.toFixed(2),
      r.changeOrderTotal.toFixed(2),
      r.adjustedBudget.toFixed(2),
      r.grossProfit.toFixed(2),
      r.profitMargin.toFixed(1),
      r.phaseCount,
      r.completedPhases,
    ]
      .map((v) => `"${v.toString().replace(/"/g, '""')}"`) // Escape double quotes
      .join(",")
  );

  return [header, ...csvRows].join("\n");
}

// ── Contractor Reports ──

/**
 * Performance summary for the currently logged-in contractor user.
 *
 * Phase discovery uses two parallel paths to catch all relevant phases:
 *   1. Phases in projects where the user has a CONTRACTOR ProjectMember row.
 *   2. Phases where a Staff record with the user's email has a PhaseAssignment.
 * Results are de-duplicated by phase ID via a Map before aggregation.
 *
 * Returns both a high-level summary and a per-phase breakdown suitable for
 * the contractor's personal dashboard and mobile view.
 */
export async function getContractorPerformance() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const now = new Date();

  // Fetch via both paths in parallel for efficiency
  const [memberPhases, staffPhases, checklistActivity] = await Promise.all([
    // Path 1: phases in projects where this user is a CONTRACTOR member
    db.phase.findMany({
      where: {
        project: {
          members: {
            some: { userId: session.user.id, role: "CONTRACTOR" },
          },
        },
      },
      include: {
        project: { select: { name: true } },
        checklist: {
          include: {
            items: {
              select: { completed: true, completedAt: true, completedById: true },
            },
          },
        },
        _count: { select: { documents: true, photos: true } },
      },
    }),

    // Path 2: phases assigned to a Staff record matching the user's email
    db.phaseAssignment.findMany({
      where: {
        staff: { email: session.user.email || "" },
      },
      include: {
        phase: {
          include: {
            project: { select: { name: true } },
            checklist: {
              include: {
                items: {
                  select: { completed: true, completedAt: true, completedById: true },
                },
              },
            },
            _count: { select: { documents: true, photos: true } },
          },
        },
      },
    }),

    // Total checklist items this user personally completed (for the KPI card)
    db.checklistItem.count({
      where: { completedById: session.user.id, completed: true },
    }),
  ]);

  // De-duplicate phases from both paths — a phase may appear in both if the
  // contractor is both a project member AND has a staff email assignment
  const phaseMap = new Map<string, (typeof memberPhases)[number]>();
  memberPhases.forEach((p: typeof memberPhases[number]) => phaseMap.set(p.id, p));
  staffPhases.forEach((a: typeof staffPhases[number]) => {
    if (!phaseMap.has(a.phase.id)) {
      phaseMap.set(a.phase.id, a.phase);
    }
  });

  const allPhases = Array.from(phaseMap.values());

  const completed = allPhases.filter((p: typeof allPhases[number]) => p.status === "COMPLETE").length;
  const active = allPhases.filter(
    (p: typeof allPhases[number]) =>
      p.status === "IN_PROGRESS" ||
      p.status === "REVIEW_REQUESTED" ||
      p.status === "UNDER_REVIEW"
  ).length;
  const overdue = allPhases.filter(
    (p: typeof allPhases[number]) => p.status !== "COMPLETE" && new Date(p.estEnd) < now
  ).length;

  const totalDocs = allPhases.reduce((sum: number, p: typeof allPhases[number]) => sum + p._count.documents, 0);
  const totalPhotos = allPhases.reduce((sum: number, p: typeof allPhases[number]) => sum + p._count.photos, 0);

  // Aggregate checklist completion across all assigned phases
  let checklistTotal = 0;
  let checklistDone = 0;
  allPhases.forEach((p: typeof allPhases[number]) => {
    if (p.checklist) {
      checklistTotal += p.checklist.items.length;
      checklistDone += p.checklist.items.filter((i: typeof p.checklist.items[number]) => i.completed).length;
    }
  });

  // On-time completion: completed phases where actualEnd ≤ estEnd
  const completedOnTime = allPhases.filter(
    (p: typeof allPhases[number]) =>
      p.status === "COMPLETE" &&
      p.actualEnd &&
      new Date(p.actualEnd) <= new Date(p.estEnd)
  ).length;

  return {
    summary: {
      totalPhases: allPhases.length,
      completed,
      active,
      overdue,
      onTimeRate:
        completed > 0 ? Math.round((completedOnTime / completed) * 100) : 100,
      checklistItemsCompleted: checklistActivity,
      checklistProgress:
        checklistTotal > 0
          ? Math.round((checklistDone / checklistTotal) * 100)
          : 0,
      documentsUploaded: totalDocs,
      photosUploaded: totalPhotos,
    },
    phases: allPhases.map((p: typeof allPhases[number]) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      progress: p.progress,
      projectName: p.project.name,
      estEnd: p.estEnd,
      // daysOverdue = 0 for on-time or complete phases
      daysOverdue:
        p.status !== "COMPLETE" && new Date(p.estEnd) < now
          ? Math.ceil(
              (now.getTime() - new Date(p.estEnd).getTime()) / 86400000
            )
          : 0,
      docs: p._count.documents,
      photos: p._count.photos,
      checklistTotal: p.checklist?.items.length || 0,
      checklistDone: p.checklist?.items.filter((i: typeof p.checklist.items[number]) => i.completed).length || 0,
    })),
  };
}
