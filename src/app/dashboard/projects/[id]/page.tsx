import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  DollarSign,
  Users,
  HardHat,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  FileText,
  Camera,
  ChevronRight,
  Activity,
  Eye,
  TrendingUp,
  Edit,
  Plus,
} from "lucide-react";
import { cn, statusColor, statusLabel, fmtShort, fmtLong, fmtRelative } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { BudgetSection } from "@/components/project/BudgetSection";
import { TeamSection } from "@/components/project/TeamSection";
import { ClientTokenSection } from "@/components/project/ClientTokenSection";
import { DailyLogSection } from "@/components/project/DailyLogSection";
import { getProjectInvitations } from "@/actions/invitations";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const [project, recentActivity] = await Promise.all([
    db.project.findUnique({
      where: { id },
      include: {
        phases: {
          include: {
            assignments: {
              include: {
                staff: { select: { id: true, name: true, company: true, role: true } },
              },
            },
            checklist: {
              include: {
                items: { select: { id: true, completed: true } },
              },
            },
            changeOrders: {
              where: { status: "APPROVED" },
              select: { id: true, amount: true },
            },
            _count: { select: { documents: true, photos: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, image: true } },
          },
        },
      },
    }),
    db.activityLog
      .findMany({
        where: { projectId: id },
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
      .catch(() => [] as never[]),
  ]);

  if (!project) notFound();

  const now = new Date();
  const phases = project.phases;

  // Compute stats
  const activePhases = phases.filter(
    (p: typeof phases[0]) =>
      p.status === "IN_PROGRESS" ||
      p.status === "REVIEW_REQUESTED" ||
      p.status === "UNDER_REVIEW"
  );
  const completedPhases = phases.filter((p: typeof phases[0]) => p.status === "COMPLETE");
  const overduePhases = phases.filter(
    (p: typeof phases[0]) => p.status !== "COMPLETE" && new Date(p.estEnd) < now
  );
  const reviewPhases = phases.filter((p: typeof phases[0]) => p.status === "REVIEW_REQUESTED");
  const overallProgress =
    phases.length > 0
      ? Math.round((completedPhases.length / phases.length) * 100)
      : 0;

  // Checklist stats
  const allChecklistItems = phases.flatMap(
    (p: typeof phases[0]) => p.checklist?.items || []
  );
  const completedChecklistItems = allChecklistItems.filter((i: { completed: boolean }) => i.completed);
  const checklistPercent =
    allChecklistItems.length > 0
      ? Math.round(
          (completedChecklistItems.length / allChecklistItems.length) * 100
        )
      : 0;

  // Document and photo counts
  const totalDocs = phases.reduce((sum: number, p: typeof phases[0]) => sum + p._count.documents, 0);
  const totalPhotos = phases.reduce((sum: number, p: typeof phases[0]) => sum + p._count.photos, 0);

  // Budget calculations
  const totalBudget = project.budget ? Number(project.budget) : 0;
  const totalSpent = phases.reduce((sum: number, p: typeof phases[0]) => {
    const cost = p.actualCost ? Number(p.actualCost) : 0;
    return sum + cost;
  }, 0);
  const totalRemaining = totalBudget - totalSpent;
  const budgetPercent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const userRole = session.user.role || "VIEWER";
  const canManageBudget = can(userRole, "manage", "phase");
  const canInvite = can(userRole, "create", "member");
  const canEditProject = can(userRole, "update", "project");

  // Fetch pending invitations for the team section
  const invitations = canInvite
    ? await getProjectInvitations(id).catch(() => [])
    : [];
  // Fetch daily logs
  const dailyLogs = await (db as any).dailyLog.findMany({
    where: { projectId: id },
    orderBy: { date: "desc" },
    take: 20,
  }).catch(() => []);

  // Fetch client portal tokens (PM/Admin only)
  const clientTokens = canManageBudget
    ? await (db as any).clientToken.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } }).catch(() => [])
    : [];

  const budgetPhases = phases.map((p: any) => {
    const phaseApprovedCOs = (p.changeOrders || []).reduce(
      (s: number, co: any) => s + (co.amount ? Number(co.amount) : 0),
      0
    );
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      estimatedCost: p.estimatedCost ? Number(p.estimatedCost) : null,
      actualCost: p.actualCost ? Number(p.actualCost) : null,
      approvedCOs: phaseApprovedCOs,
      adjustedEstimate: (p.estimatedCost ? Number(p.estimatedCost) : 0) + phaseApprovedCOs,
    };
  });
  const totalApprovedCOs = budgetPhases.reduce((s: number, p: any) => s + p.approvedCOs, 0);
  const adjustedBudget = totalBudget > 0 ? totalBudget + totalApprovedCOs : null;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Navigation Breadcrumb */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Project Header */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-gray-600">
              {project.address && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {project.address}
                </span>
              )}
              {project.estCompletion && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  Est. {fmtLong(project.estCompletion)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                "text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap",
                statusColor(project.status)
              )}
            >
              {statusLabel(project.status)}
            </span>
            {canEditProject && (
              <Link
                href={`/dashboard/projects/${id}/edit`}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                <Edit className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </Link>
            )}
            <Link
              href={`/dashboard/projects/${id}/timeline`}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Timeline</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Budget Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BudgetCard
          label="Total Budget"
          value={totalBudget}
          icon={<DollarSign className="w-5 h-5" />}
          color="blue"
        />
        <BudgetCard
          label="Total Spent"
          value={totalSpent}
          icon={<TrendingUp className="w-5 h-5" />}
          color={budgetPercent > 80 ? "red" : "amber"}
        />
        <BudgetCard
          label="Remaining"
          value={totalRemaining}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color={totalRemaining < 0 ? "red" : "green"}
        />
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-semibold uppercase text-gray-600 tracking-wide">Budget Used</span>
            <span className="text-2xl font-bold text-gray-900">{budgetPercent}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full transition-all"
              style={{
                width: `${Math.min(budgetPercent, 100)}%`,
                backgroundColor:
                  budgetPercent > 100 ? "#dc2626" :
                  budgetPercent > 80 ? "#ea580c" :
                  budgetPercent > 50 ? "#f59e0b" :
                  "var(--color-primary)",
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {budgetPercent > 100
              ? `Over budget by $${Math.abs(totalRemaining).toLocaleString()}`
              : `$${totalRemaining.toLocaleString()} remaining`
            }
          </p>
        </div>
      </div>

      {/* Timeline Preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Project Progress
          </h2>
          <Link
            href={`/dashboard/projects/${id}/timeline`}
            className="text-xs text-[var(--color-primary)] hover:underline font-medium"
          >
            View full timeline
          </Link>
        </div>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Phases Completed</span>
              <span className="text-sm font-bold text-gray-900">{overallProgress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${overallProgress}%`,
                  backgroundColor:
                    overallProgress === 100 ? "#16a34a" : "var(--color-primary)",
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {completedPhases.length} of {phases.length} phases complete
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={<HardHat className="w-4 h-4" />}
          label="Active"
          value={activePhases.length}
          color="blue"
        />
        <StatCard
          icon={<Eye className="w-4 h-4" />}
          label="Review"
          value={reviewPhases.length}
          color={reviewPhases.length > 0 ? "amber" : "green"}
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Overdue"
          value={overduePhases.length}
          color={overduePhases.length > 0 ? "red" : "green"}
        />
        <StatCard
          icon={<ClipboardCheck className="w-4 h-4" />}
          label="Checklist"
          value={`${checklistPercent}%`}
          color={checklistPercent >= 80 ? "green" : "blue"}
        />
        <StatCard
          icon={<FileText className="w-4 h-4" />}
          label="Documents"
          value={totalDocs}
          color="purple"
        />
        <StatCard
          icon={<Camera className="w-4 h-4" />}
          label="Photos"
          value={totalPhotos}
          color="purple"
        />
      </div>

      {/* Budget */}
      <BudgetSection
        projectId={id}
        projectBudget={project.budget ? Number(project.budget) : null}
        phases={budgetPhases}
        canManage={canManageBudget}
        totalApprovedCOs={totalApprovedCOs}
        adjustedBudget={adjustedBudget}
      />

      {/* Daily Logs */}
      <DailyLogSection
        projectId={id}
        logs={dailyLogs}
        canCreate={can(userRole, "create", "document")}
      />

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Phase list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              All Phases
            </h2>
            {canEditProject && (
              <Link
                href={`/dashboard/projects/${id}/phases/new`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-bg)] rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Phase</span>
              </Link>
            )}
          </div>
          <div className="space-y-2">
            {phases.map((phase: typeof phases[0]) => {
              const isOverdue =
                phase.status !== "COMPLETE" && new Date(phase.estEnd) < now;
              const checkItems = phase.checklist?.items || [];
              const checkDone = checkItems.filter((i: { completed: boolean }) => i.completed).length;
              const owner = phase.assignments.find(
                (a: { isOwner: boolean }) => a.isOwner
              );

              return (
                <Link
                  key={phase.id}
                  href={`/dashboard/projects/${id}/phases/${phase.id}`}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-[var(--color-primary-light)] hover:shadow-sm transition-all group"
                >
                  {/* Status indicator */}
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      phase.status === "COMPLETE"
                        ? "bg-green-500"
                        : phase.status === "IN_PROGRESS"
                        ? "bg-blue-500"
                        : phase.status === "REVIEW_REQUESTED"
                        ? "bg-amber-500"
                        : phase.status === "UNDER_REVIEW"
                        ? "bg-purple-500"
                        : "bg-gray-300"
                    )}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {phase.name}
                      </span>
                      {phase.isMilestone && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                          Milestone
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span>
                        {fmtShort(phase.estStart)} — {fmtShort(phase.estEnd)}
                      </span>
                      {owner && (
                        <span className="truncate">
                          {owner.staff.name}
                        </span>
                      )}
                      {checkItems.length > 0 && (
                        <span>
                          {checkDone}/{checkItems.length} items
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Counters — hidden on very small screens */}
                  <div className="hidden sm:flex items-center gap-3 shrink-0">
                    {phase._count.documents > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <FileText className="w-3.5 h-3.5" />
                        {phase._count.documents}
                      </span>
                    )}
                    {phase._count.photos > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Camera className="w-3.5 h-3.5" />
                        {phase._count.photos}
                      </span>
                    )}
                  </div>

                  {/* Status badge */}
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0",
                      isOverdue
                        ? "bg-red-100 text-red-700"
                        : statusColor(phase.status)
                    )}
                  >
                    {isOverdue ? "Overdue" : statusLabel(phase.status)}
                  </span>

                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[var(--color-primary)] transition-colors shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: Team + Activity */}
        <div className="space-y-5">
          {/* Team */}
          <TeamSection
            projectId={id}
            members={project.members.map((m: { id: string; role: string; user: { id: string; name: string | null; email: string; role: string; image: string | null } }) => ({
              id: m.id,
              role: m.role,
              user: m.user,
            }))}
            invitations={invitations.map((inv: { id: string; email: string; role: string; expiresAt: Date; createdAt: Date }) => ({
              id: inv.id,
              email: inv.email,
              role: inv.role,
              expiresAt: inv.expiresAt,
              createdAt: inv.createdAt,
            }))}
            canInvite={canInvite}
            currentUserId={session.user.id}
          />

          {/* Client Portal Links */}
          {canManageBudget && clientTokens.length >= 0 && (
            <ClientTokenSection projectId={id} tokens={clientTokens} />
          )}

          {/* Recent Activity */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              Recent Activity
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {recentActivity.length === 0 ? (
                <div className="p-6 text-center">
                  <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No activity yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentActivity.slice(0, 5).map(
                    (entry: { id: string; action: string; message: string; createdAt: Date; user: { name: string | null; email: string } }) => (
                      <div key={entry.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            {getActivityIcon(entry.action)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {entry.message}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">
                                {entry.user.name || entry.user.email}
                              </span>
                              <span className="text-xs text-gray-400">·</span>
                              <span className="text-xs text-gray-400">
                                {fmtRelative(entry.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper Components ──

function BudgetCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "red" | "green" | "amber";
}): React.ReactNode {
  const colorMap: Record<string, string> = {
    blue: "bg-[var(--color-primary-bg)] text-[var(--color-primary)] border-[var(--color-primary-bg)]",
    red: "bg-red-50 text-red-600 border-red-100",
    green: "bg-green-50 text-green-600 border-green-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
  };

  const iconBg: Record<string, string> = {
    blue: "bg-[var(--color-primary-bg)] text-[var(--color-primary)]",
    red: "bg-red-100 text-red-600",
    green: "bg-green-100 text-green-600",
    amber: "bg-amber-100 text-amber-600",
  };

  return (
    <div className={cn("rounded-xl border p-4 sm:p-5", colorMap[color])}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2 rounded-lg", iconBg[color])}>
          {icon}
        </div>
        <span className="text-xs font-semibold uppercase text-current opacity-70">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-current">
        ${value.toLocaleString()}
      </p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: "blue" | "red" | "green" | "purple" | "amber";
}): React.ReactNode {
  const colors: Record<string, string> = {
    blue: "bg-[var(--color-primary-bg)] text-[var(--color-primary)]",
    red: "bg-red-50 text-red-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className={cn("rounded-xl p-3 text-center", colors[color])}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] font-medium uppercase opacity-70">{label}</p>
    </div>
  );
}

function getActivityIcon(action: string): React.ReactNode {
  const iconClass = "w-4 h-4";
  switch (action) {
    case "PHASE_STATUS_CHANGED":
      return <HardHat className={cn(iconClass, "text-[var(--color-primary)]")} />;
    case "PHASE_CREATED":
      return <TrendingUp className={cn(iconClass, "text-green-500")} />;
    case "STAFF_ASSIGNED":
    case "STAFF_UNASSIGNED":
      return <Users className={cn(iconClass, "text-purple-500")} />;
    case "CHECKLIST_APPLIED":
    case "CHECKLIST_ITEM_TOGGLED":
      return <ClipboardCheck className={cn(iconClass, "text-green-500")} />;
    case "DOCUMENT_UPLOADED":
    case "DOCUMENT_STATUS_CHANGED":
      return <FileText className={cn(iconClass, "text-amber-500")} />;
    case "PHOTO_UPLOADED":
      return <Camera className={cn(iconClass, "text-pink-500")} />;
    default:
      return <Activity className={cn(iconClass, "text-gray-400")} />;
  }
}
