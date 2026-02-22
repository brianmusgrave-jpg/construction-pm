import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canCreateProject } from "@/lib/permissions";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Plus,
  FolderKanban,
  Calendar,
  Users,
  HardHat,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  FileText,
  ArrowRight,
  Activity,
  Bell,
  Eye,
  ChevronRight,
  Building2,
  TrendingUp,
  CircleDot,
} from "lucide-react";
import { cn, statusColor, statusLabel, fmtShort, fmtRelative } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Fetch all data in parallel
  const [
    projects,
    allPhases,
    recentNotifications,
    pendingDocuments,
    checklistStats,
    recentActivity,
  ] = await Promise.all([
    // Projects with counts
    db.project.findMany({
      where: { members: { some: { userId: session.user.id } } },
      include: {
        _count: { select: { phases: true, members: true } },
        phases: {
          select: {
            id: true,
            name: true,
            status: true,
            progress: true,
            estStart: true,
            estEnd: true,
            worstEnd: true,
            projectId: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),

    // All phases the user can see
    db.phase.findMany({
      where: {
        project: { members: { some: { userId: session.user.id } } },
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
    }),

    // Recent notifications for this user
    db.notification
      .findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      })
      .catch(() => [] as never[]),

    // Pending documents count
    db.document
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

    // Checklist stats
    Promise.all([
      db.checklistItem
        .count({
          where: {
            completed: true,
            checklist: {
              phase: {
                status: { in: ["IN_PROGRESS", "REVIEW_REQUESTED", "UNDER_REVIEW"] },
                project: {
                  members: { some: { userId: session.user.id } },
                },
              },
            },
          },
        })
        .catch(() => 0),
      db.checklistItem
        .count({
          where: {
            checklist: {
              phase: {
                status: { in: ["IN_PROGRESS", "REVIEW_REQUESTED", "UNDER_REVIEW"] },
                project: {
                  members: { some: { userId: session.user.id } },
                },
              },
            },
          },
        })
        .catch(() => 0),
    ]),

    // Recent activity log
    db.activityLog
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
      .catch(() => [] as never[]),
  ]);

  const showCreate = canCreateProject(session.user.role);
  const now = new Date();
  const [completedItems, totalItems] = checklistStats;

  // Compute widget data
  const activePhases = allPhases.filter(
    (p) =>
      p.status === "IN_PROGRESS" ||
      p.status === "REVIEW_REQUESTED" ||
      p.status === "UNDER_REVIEW"
  );

  const reviewPhases = allPhases.filter(
    (p) => p.status === "REVIEW_REQUESTED"
  );

  const overduePhases = allPhases.filter(
    (p) => p.status !== "COMPLETE" && new Date(p.estEnd) < now
  );

  const completedPhases = allPhases.filter(
    (p) => p.status === "COMPLETE"
  );

  const upcomingPhases = allPhases
    .filter(
      (p) =>
        p.status === "PENDING" &&
        new Date(p.estStart) <= new Date(now.getTime() + 14 * 86400000)
    )
    .slice(0, 5);

  const greeting = getGreeting();
  const checklistPercent =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Items needing attention
  const attentionCount = reviewPhases.length + (pendingDocuments as number) + overduePhases.length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {greeting}, {session.user.name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {attentionCount > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                · {attentionCount} item{attentionCount !== 1 ? "s" : ""} need
                {attentionCount === 1 ? "s" : ""} attention
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
            <span className="hidden sm:inline">New Project</span>
            <span className="sm:hidden">New</span>
          </Link>
        )}
      </div>

      {/* KPI Widgets */}
      <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
        <WidgetCard
          icon={<HardHat className="w-5 h-5" />}
          label="Active Phases"
          value={activePhases.length}
          color="blue"
          detail={`${allPhases.length} total`}
        />
        <WidgetCard
          icon={<Eye className="w-5 h-5" />}
          label="Needs Review"
          value={reviewPhases.length}
          color={reviewPhases.length > 0 ? "amber" : "green"}
          detail={
            reviewPhases.length > 0 ? "awaiting approval" : "all clear"
          }
        />
        <WidgetCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Overdue"
          value={overduePhases.length}
          color={overduePhases.length > 0 ? "red" : "green"}
          detail={overduePhases.length > 0 ? "past deadline" : "on track"}
        />
        <WidgetCard
          icon={<FileText className="w-5 h-5" />}
          label="Pending Docs"
          value={pendingDocuments as number}
          color={(pendingDocuments as number) > 0 ? "amber" : "green"}
          detail={(pendingDocuments as number) > 0 ? "need review" : "all reviewed"}
        />
        <WidgetCard
          icon={<ClipboardCheck className="w-5 h-5" />}
          label="Checklists"
          value={checklistPercent}
          valueSuffix="%"
          color={checklistPercent >= 80 ? "green" : checklistPercent >= 50 ? "blue" : "amber"}
          detail={`${completedItems}/${totalItems} items`}
        />
      </div>

      {/* Attention Panel — only show when there are items */}
      {(reviewPhases.length > 0 || overduePhases.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <CircleDot className="w-4 h-4 text-amber-500" />
              Needs Your Attention
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {/* Review Requested phases */}
            {reviewPhases.map((phase) => (
              <Link
                key={phase.id}
                href={`/dashboard/projects/${phase.project.id}/phases/${phase.id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-blue-50/50 transition-colors group"
              >
                <div className="p-2 rounded-lg bg-amber-100 text-amber-600 shrink-0">
                  <Eye className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    Review Requested: {phase.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {phase.project.name}
                    {phase.assignments[0] &&
                      ` · ${phase.assignments[0].staff.name}`}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full shrink-0",
                    statusColor("REVIEW_REQUESTED")
                  )}
                >
                  {statusLabel("REVIEW_REQUESTED")}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[var(--color-primary)] transition-colors shrink-0" />
              </Link>
            ))}

            {/* Overdue phases */}
            {overduePhases.slice(0, 4).map((phase) => {
              const daysOver = Math.ceil(
                (now.getTime() - new Date(phase.estEnd).getTime()) / 86400000
              );
              return (
                <Link
                  key={phase.id}
                  href={`/dashboard/projects/${phase.project.id}/phases/${phase.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-red-50/50 transition-colors group"
                >
                  <div className="p-2 rounded-lg bg-red-100 text-red-600 shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      Overdue: {phase.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {phase.project.name}
                      {phase.assignments[0] &&
                        ` · ${phase.assignments[0].staff.name}`}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
                    {daysOver}d overdue
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-500 transition-colors shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Main content: two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left column: Projects + Upcoming */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Upcoming Starts */}
          {upcomingPhases.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4" />
                Starting Soon (next 2 weeks)
              </h3>
              <div className="space-y-2">
                {upcomingPhases.map((phase) => (
                  <Link
                    key={phase.id}
                    href={`/dashboard/projects/${phase.project.id}/phases/${phase.id}`}
                    className="flex items-center justify-between p-2 bg-white rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {phase.name}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        {phase.project.name}
                      </span>
                    </div>
                    <span className="text-xs text-amber-700">
                      {fmtShort(phase.estStart)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Project Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Projects
              </h2>
              <span className="text-xs text-gray-500">
                {projects.filter((p: { status: string }) => p.status === "ACTIVE").length} active · {projects.length} total
              </span>
            </div>
            {projects.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  No projects yet
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Create your first project to get started.
                </p>
                {showCreate && (
                  <Link
                    href="/dashboard/projects/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)]"
                  >
                    <Plus className="w-4 h-4" />
                    New Project
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project: (typeof projects)[number]) => {
                  const phases = project.phases;
                  const completed = phases.filter(
                    (p: { status: string }) => p.status === "COMPLETE"
                  ).length;
                  const total = project._count.phases;
                  const progress =
                    total > 0 ? Math.round((completed / total) * 100) : 0;

                  // Find the current active phase
                  const currentPhase = phases.find(
                    (p: { status: string }) =>
                      p.status === "IN_PROGRESS" ||
                      p.status === "REVIEW_REQUESTED" ||
                      p.status === "UNDER_REVIEW"
                  );

                  // Next pending phase
                  const nextPhase = phases.find(
                    (p: { status: string }) => p.status === "PENDING"
                  );

                  return (
                    <Link
                      key={project.id}
                      href={`/dashboard/projects/${project.id}`}
                      className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-[var(--color-primary-light)] hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">
                            {project.name}
                          </h3>
                          {project.address && (
                            <p className="text-sm text-gray-500 mt-0.5">
                              {project.address}
                            </p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap",
                            statusColor(project.status)
                          )}
                        >
                          {statusLabel(project.status)}
                        </span>
                      </div>

                      {/* Current / Next Phase */}
                      {currentPhase && (
                        <div className="flex items-center gap-2 mb-3 p-2 bg-[var(--color-primary-bg)] rounded-lg">
                          <HardHat className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                          <span className="text-sm text-[var(--color-primary-dark)] font-medium truncate">
                            {currentPhase.name}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-medium px-1.5 py-0.5 rounded ml-auto shrink-0",
                              statusColor(currentPhase.status)
                            )}
                          >
                            {statusLabel(currentPhase.status)}
                          </span>
                        </div>
                      )}
                      {!currentPhase && nextPhase && (
                        <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
                          <Clock className="w-4 h-4 text-gray-500 shrink-0" />
                          <span className="text-sm text-gray-700 truncate">
                            Next: {nextPhase.name}
                          </span>
                          <span className="text-xs text-gray-500 ml-auto shrink-0">
                            {fmtShort(nextPhase.estStart)}
                          </span>
                        </div>
                      )}

                      {/* Progress + Stats */}
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{
                                width: `${progress}%`,
                                backgroundColor:
                                  progress === 100
                                    ? "#16a34a"
                                    : "var(--color-primary)",
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {completed}/{total} phases
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Users className="w-3.5 h-3.5" />
                          {project._count.members}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Notifications + Activity + Quick Links */}
        <div className="space-y-5">
          {/* Recent Notifications */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Notifications
              </h2>
              <Link
                href="/dashboard/notifications"
                className="text-xs text-[var(--color-primary)] hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {recentNotifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No notifications yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Status changes, reviews, and uploads will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentNotifications.map(
                    (notif: {
                      id: string;
                      type: string;
                      title: string;
                      message: string;
                      read: boolean;
                      createdAt: Date;
                    }) => (
                      <div
                        key={notif.id}
                        className={cn(
                          "px-4 py-3 transition-colors",
                          !notif.read && "bg-blue-50/40"
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          {!notif.read && (
                            <span className="mt-1.5 w-2 h-2 rounded-full bg-[var(--color-primary)] shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "text-sm truncate",
                                !notif.read
                                  ? "font-medium text-gray-900"
                                  : "text-gray-700"
                              )}
                            >
                              {notif.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {notif.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {fmtRelative(notif.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              Activity
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {recentActivity.length === 0 ? (
                <div className="p-6 text-center">
                  <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No activity yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Status changes and uploads will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentActivity.map(
                    (entry: {
                      id: string;
                      action: string;
                      message: string;
                      createdAt: Date;
                      user: { name: string | null; email: string };
                      project: { name: string };
                    }) => (
                      <div key={entry.id} className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 shrink-0">
                            {getActivityIcon(entry.action)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-gray-900">
                              {entry.message}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
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

          {/* Quick Links */}
          <div className="space-y-2">
            <Link
              href="/dashboard/directory"
              className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 hover:border-[var(--color-primary-light)] transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Users className="w-4 h-4 text-gray-400" />
                Directory
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>
            <Link
              href="/dashboard/settings"
              className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 hover:border-[var(--color-primary-light)] transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Building2 className="w-4 h-4 text-gray-400" />
                Settings
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper Components ──

function WidgetCard({
  icon,
  label,
  value,
  valueSuffix,
  color,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  valueSuffix?: string;
  color: "blue" | "red" | "green" | "purple" | "amber";
  detail: string;
}) {
  const colorMap = {
    blue: "bg-[var(--color-primary-bg)] text-[var(--color-primary)] border-[var(--color-primary-bg)]",
    red: "bg-red-50 text-red-600 border-red-100",
    green: "bg-green-50 text-green-600 border-green-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
  };

  const iconBg = {
    blue: "bg-[var(--color-primary-bg)] text-[var(--color-primary)]",
    red: "bg-red-100 text-red-600",
    green: "bg-green-100 text-green-600",
    purple: "bg-purple-100 text-purple-600",
    amber: "bg-amber-100 text-amber-600",
  };

  return (
    <div
      className={cn("rounded-xl border p-4 transition-colors min-w-[140px] sm:min-w-0 shrink-0 sm:shrink", colorMap[color])}
    >
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", iconBg[color])}>{icon}</div>
        <div>
          <p className="text-2xl font-bold">
            {value}
            {valueSuffix && (
              <span className="text-base font-semibold">{valueSuffix}</span>
            )}
          </p>
          <p className="text-xs font-medium opacity-80">{label}</p>
        </div>
      </div>
      <p className="text-xs mt-2 opacity-70">{detail}</p>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getActivityIcon(action: string): React.ReactNode {
  const iconClass = "w-4 h-4";
  switch (action) {
    case "PHASE_STATUS_CHANGED":
      return (
        <HardHat className={cn(iconClass, "text-[var(--color-primary)]")} />
      );
    case "STAFF_ASSIGNED":
    case "STAFF_UNASSIGNED":
      return <Users className={cn(iconClass, "text-purple-500")} />;
    case "CHECKLIST_APPLIED":
    case "CHECKLIST_ITEM_TOGGLED":
      return <ClipboardCheck className={cn(iconClass, "text-green-500")} />;
    case "DOCUMENT_UPLOADED":
      return <FileText className={cn(iconClass, "text-amber-500")} />;
    default:
      return <Activity className={cn(iconClass, "text-gray-400")} />;
  }
}
