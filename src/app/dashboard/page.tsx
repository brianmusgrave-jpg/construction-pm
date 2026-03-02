/**
 * @file src/app/dashboard/page.tsx
 * @description Main dashboard page — Sprint 25 widget system.
 * Server component that fetches all data in parallel and delegates rendering
 * to the client-side DashboardShell (widget grid with drag, collapse, resize).
 */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canCreateProject } from "@/lib/permissions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/i18n/locale";
import { getAnalytics } from "@/actions/analytics";
import { getDashboardLayout } from "@/actions/dashboard-layout";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [t, locale, analytics, savedLayout] = await Promise.all([
    getTranslations("dashboard"),
    getLocale(),
    getAnalytics().catch(() => null),
    getDashboardLayout().catch(() => null),
  ]);

  // Fetch all data in parallel
  const [
    projects,
    allPhases,
    recentNotifications,
    pendingDocuments,
    checklistStats,
    recentActivity,
  ] = await Promise.all([
    (db as any).project.findMany({
      where: { members: { some: { userId: session.user.id } } },
      include: {
        _count: { select: { phases: true, members: true } },
        phases: {
          select: {
            id: true, name: true, status: true, progress: true,
            estStart: true, estEnd: true, worstEnd: true, projectId: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    (db as any).phase.findMany({
      where: {
        project: { members: { some: { userId: session.user.id } } },
        status: { not: "COMPLETE" },
      },
      include: {
        project: { select: { id: true, name: true } },
        assignments: {
          include: { staff: { select: { name: true } } },
          where: { isOwner: true },
          take: 1,
        },
      },
      orderBy: { estEnd: "asc" },
      take: 200,
    }),
    (db as any).notification
      .findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      })
      .catch(() => []),
    (db as any).document
      .count({
        where: {
          status: "PENDING",
          phase: {
            project: {
              members: { some: { userId: session.user.id } },
            },
          },
        },
      })
      .catch(() => 0),
    Promise.all([
      (db as any).checklistItem
        .count({
          where: {
            completed: true,
            checklist: {
              phase: {
                status: { in: ["IN_PROGRESS", "REVIEW_REQUESTED", "UNDER_REVIEW"] },
                project: { members: { some: { userId: session.user.id } } },
              },
            },
          },
        })
        .catch(() => 0),
      (db as any).checklistItem
        .count({
          where: {
            checklist: {
              phase: {
                status: { in: ["IN_PROGRESS", "REVIEW_REQUESTED", "UNDER_REVIEW"] },
                project: { members: { some: { userId: session.user.id } } },
              },
            },
          },
        })
        .catch(() => 0),
    ]),
    (db as any).activityLog
      .findMany({
        where: {
          project: { members: { some: { userId: session.user.id } } },
        },
        include: {
          user: { select: { name: true, email: true } },
          project: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
      .catch(() => []),
  ]);

  const showCreate = canCreateProject(session.user.role);
  const now = new Date();
  const [completedItems, totalItems] = checklistStats;

  const totalPhaseCount = projects.reduce(
    (sum: number, p: any) => sum + p._count.phases, 0
  );
  const activePhases = allPhases.filter(
    (p: any) =>
      p.status === "IN_PROGRESS" || p.status === "REVIEW_REQUESTED" || p.status === "UNDER_REVIEW"
  );
  const reviewPhases = allPhases.filter(
    (p: any) => p.status === "REVIEW_REQUESTED"
  );
  const overduePhases = allPhases.filter(
    (p: any) => new Date(p.estEnd) < now
  );
  const upcomingPhases = allPhases
    .filter(
      (p: any) =>
        p.status === "PENDING" &&
        new Date(p.estStart) <= new Date(now.getTime() + 14 * 86400000)
    )
    .slice(0, 5);

  const checklistPercent =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const attentionCount = reviewPhases.length + (pendingDocuments as number) + overduePhases.length;
  const greeting = getGreeting(t);

  // ── Serialize data for the client boundary ──────────────────────────

  const kpi = {
    activePhases: activePhases.length,
    totalPhases: totalPhaseCount,
    reviewPhases: reviewPhases.length,
    overduePhases: overduePhases.length,
    pendingDocs: pendingDocuments as number,
    checklistPercent,
    completedItems,
    totalItems,
  };

  const serializedReviewPhases = reviewPhases.map((p: any) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    estEnd: new Date(p.estEnd).toISOString(),
    project: { id: p.project.id, name: p.project.name },
    assignee: p.assignments?.[0]?.staff?.name || undefined,
  }));

  const serializedOverduePhases = overduePhases.slice(0, 4).map((p: any) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    estEnd: new Date(p.estEnd).toISOString(),
    project: { id: p.project.id, name: p.project.name },
    assignee: p.assignments?.[0]?.staff?.name || undefined,
  }));

  const serializedProjects = projects
    .filter((p: any) => p.status !== "ARCHIVED")
    .map((project: any) => {
      const phases = project.phases;
      const completed = phases.filter((p: any) => p.status === "COMPLETE").length;
      const total = project._count.phases;
      const currentPhase = phases.find(
        (p: any) =>
          p.status === "IN_PROGRESS" || p.status === "REVIEW_REQUESTED" || p.status === "UNDER_REVIEW"
      );
      const nextPhase = phases.find((p: any) => p.status === "PENDING");
      return {
        id: project.id,
        name: project.name,
        status: project.status,
        address: project.address || undefined,
        phaseCount: total,
        completedCount: completed,
        memberCount: project._count.members,
        currentPhase: currentPhase
          ? { id: currentPhase.id, name: currentPhase.name, status: currentPhase.status, estStart: new Date(currentPhase.estStart).toISOString() }
          : undefined,
        nextPhase: nextPhase
          ? { id: nextPhase.id, name: nextPhase.name, status: nextPhase.status, estStart: new Date(nextPhase.estStart).toISOString() }
          : undefined,
      };
    });

  const serializedNotifications = recentNotifications.map((n: any) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    read: n.read,
    createdAt: new Date(n.createdAt).toISOString(),
  }));

  const serializedActivity = recentActivity.map((a: any) => ({
    id: a.id,
    action: a.action,
    message: a.message,
    createdAt: new Date(a.createdAt).toISOString(),
    userName: a.user?.name || a.user?.email || "",
    projectName: a.project?.name || "",
  }));

  const serializedUpcoming = upcomingPhases.map((p: any) => ({
    id: p.id,
    name: p.name,
    estStart: new Date(p.estStart).toISOString(),
    project: { id: p.project.id, name: p.project.name },
  }));

  const projectList = projects.map((p: any) => ({ id: p.id, name: p.name }));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {greeting}, {session.user.name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {attentionCount > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                · {attentionCount} {attentionCount === 1 ? "item needs" : "items need"} attention
              </span>
            )}
          </p>
        </div>
        {showCreate && (
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("newProject")}</span>
            <span className="sm:hidden">{t("new")}</span>
          </Link>
        )}
      </div>

      {/* Widget Grid */}
      <DashboardShell
        userRole={session.user.role}
        savedLayout={savedLayout}
        showCreate={showCreate}
        kpi={kpi}
        reviewPhases={serializedReviewPhases}
        overduePhases={serializedOverduePhases}
        projects={serializedProjects}
        notifications={serializedNotifications}
        activity={serializedActivity}
        upcomingPhases={serializedUpcoming}
        analytics={analytics}
        projectList={projectList}
      />
    </div>
  );
}

function getGreeting(t: (key: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t("goodMorning");
  if (hour < 17) return t("goodAfternoon");
  return t("goodEvening");
}
