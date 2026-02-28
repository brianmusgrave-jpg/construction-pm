"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ── Admin / PM Reports ──

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

    // Schedule health: ratio of on-time vs overdue
    const health =
      overdue > 0 ? "at-risk" : active > 0 ? "on-track" : "not-started";

    return {
      id: project.id,
      name: project.name,
      address: project.address,
      status: project.status,
      budget: project.budget ? Number(project.budget) : null,
      estCompletion: project.estCompletion,
      memberCount: project._count.members,
      phases: { total, completed, active, overdue, pending },
      progress,
      health,
    };
  });
}

export async function getPhaseStatusBreakdown() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const phases = await db.phase.findMany({
    where: { project: { members: { some: { userId: session.user.id } } } },
    select: { status: true },
  });

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
    db.document.groupBy({
      by: ["status"],
      where,
      _count: true,
    }),
    db.document.groupBy({
      by: ["category"],
      where,
      _count: true,
    }),
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

  // Group by day
  const dailyCounts: Record<string, number> = {};
  activity.forEach((a: typeof activity[number]) => {
    const day = a.createdAt.toISOString().split("T")[0];
    dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  });

  // Also group by action type
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

export async function getTeamPerformance() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Get all staff with their assignment data
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
    .filter((s: typeof staff[number]) => s.assignments.length > 0)
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
        isOwnerCount: s.assignments.filter((a: typeof s.assignments[number]) => a.isOwner).length,
      };
    });
}

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
        take: 1,
      },
    },
    orderBy: { estEnd: "asc" },
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

// ── Job P&L Report (Sprint Y #54) ──

export interface JobPLRow {
  projectId: string;
  projectName: string;
  status: string;
  budget: number;
  totalEstimatedCost: number;
  totalActualCost: number;
  changeOrderTotal: number;
  adjustedBudget: number;
  grossProfit: number;
  profitMargin: number;
  phaseCount: number;
  completedPhases: number;
}

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
            where: { status: "APPROVED" },
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
      .map((v) => `"${v.toString().replace(/"/g, '""')}"`)
      .join(",")
  );

  return [header, ...csvRows].join("\n");
}

// ── Contractor Reports ──

export async function getContractorPerformance() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const now = new Date();

  // Find phases assigned to this contractor via ProjectMember + PhaseAssignment
  const [memberPhases, staffPhases, checklistActivity] = await Promise.all([
    // Phases from projects where user is a member
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

    // Phases assigned to staff matching user email
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

    // Checklist items completed by this user
    db.checklistItem.count({
      where: { completedById: session.user.id, completed: true },
    }),
  ]);

  // Merge unique phases
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

  // Checklist stats across all assigned phases
  let checklistTotal = 0;
  let checklistDone = 0;
  allPhases.forEach((p: typeof allPhases[number]) => {
    if (p.checklist) {
      checklistTotal += p.checklist.items.length;
      checklistDone += p.checklist.items.filter((i: typeof p.checklist.items[number]) => i.completed).length;
    }
  });

  // On-time completion rate
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
