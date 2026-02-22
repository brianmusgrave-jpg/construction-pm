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

  return projects.map((project) => {
    const phases = project.phases;
    const completed = phases.filter((p) => p.status === "COMPLETE").length;
    const active = phases.filter(
      (p) =>
        p.status === "IN_PROGRESS" ||
        p.status === "REVIEW_REQUESTED" ||
        p.status === "UNDER_REVIEW"
    ).length;
    const overdue = phases.filter(
      (p) => p.status !== "COMPLETE" && new Date(p.estEnd) < now
    ).length;
    const pending = phases.filter((p) => p.status === "PENDING").length;
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
  phases.forEach((p) => {
    counts[p.status] = (counts[p.status] || 0) + 1;
  });

  return Object.entries(counts).map(([status, count]) => ({
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
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byCategory: byCategory.map((c) => ({
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
  activity.forEach((a) => {
    const day = a.createdAt.toISOString().split("T")[0];
    dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  });

  // Also group by action type
  const actionCounts: Record<string, number> = {};
  activity.forEach((a) => {
    actionCounts[a.action] = (actionCounts[a.action] || 0) + 1;
  });

  return {
    daily: Object.entries(dailyCounts).map(([date, count]) => ({
      date,
      count,
    })),
    byAction: Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count),
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
    .filter((s) => s.assignments.length > 0)
    .map((s) => {
      const phases = s.assignments.map((a) => a.phase);
      const completed = phases.filter((p) => p.status === "COMPLETE").length;
      const active = phases.filter(
        (p) =>
          p.status === "IN_PROGRESS" ||
          p.status === "REVIEW_REQUESTED" ||
          p.status === "UNDER_REVIEW"
      ).length;
      const overdue = phases.filter(
        (p) => p.status !== "COMPLETE" && new Date(p.estEnd) < now
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
        isOwnerCount: s.assignments.filter((a) => a.isOwner).length,
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

  return overduePhases.map((p) => {
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
  memberPhases.forEach((p) => phaseMap.set(p.id, p));
  staffPhases.forEach((a) => {
    if (!phaseMap.has(a.phase.id)) {
      phaseMap.set(a.phase.id, a.phase);
    }
  });

  const allPhases = Array.from(phaseMap.values());

  const completed = allPhases.filter((p) => p.status === "COMPLETE").length;
  const active = allPhases.filter(
    (p) =>
      p.status === "IN_PROGRESS" ||
      p.status === "REVIEW_REQUESTED" ||
      p.status === "UNDER_REVIEW"
  ).length;
  const overdue = allPhases.filter(
    (p) => p.status !== "COMPLETE" && new Date(p.estEnd) < now
  ).length;

  const totalDocs = allPhases.reduce((sum, p) => sum + p._count.documents, 0);
  const totalPhotos = allPhases.reduce((sum, p) => sum + p._count.photos, 0);

  // Checklist stats across all assigned phases
  let checklistTotal = 0;
  let checklistDone = 0;
  allPhases.forEach((p) => {
    if (p.checklist) {
      checklistTotal += p.checklist.items.length;
      checklistDone += p.checklist.items.filter((i) => i.completed).length;
    }
  });

  // On-time completion rate
  const completedOnTime = allPhases.filter(
    (p) =>
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
    phases: allPhases.map((p) => ({
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
      checklistDone: p.checklist?.items.filter((i) => i.completed).length || 0,
    })),
  };
}
