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
} from "lucide-react";
import { cn, statusColor, statusLabel, fmtShort, fmtRelative } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Fetch all data in parallel
  const [projects, allPhases, recentActivity, _totalChecklistItems] =
    await Promise.all([
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

      // All phases the user can see (for widgets)
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

      // Recent activity
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
          take: 15,
        })
        .catch(() => [] as never[]), // Table might not exist yet

      // Checklist completion stats — count total and completed separately
      db.checklistItem
        .count({
          where: {
            checklist: {
              phase: {
                project: {
                  members: { some: { userId: session.user.id } },
                },
              },
            },
          },
        })
        .catch(() => 0),
    ]);

  const showCreate = canCreateProject(session.user.role);
  const now = new Date();

  // Compute widget data
  const activePhases = allPhases.filter(
    (p: { status: string }) =>
      p.status === "IN_PROGRESS" ||
      p.status === "REVIEW_REQUESTED" ||
      p.status === "UNDER_REVIEW"
  );

  const overduePhases = allPhases.filter(
    (p: { status: string; estEnd: Date }) =>
      p.status !== "COMPLETE" && new Date(p.estEnd) < now
  );

  const completedPhases = allPhases.filter(
    (p: { status: string }) => p.status === "COMPLETE"
  );

  const upcomingPhases = allPhases
    .filter(
      (p: { status: string; estStart: Date }) =>
        p.status === "PENDING" &&
        new Date(p.estStart) <= new Date(now.getTime() + 14 * 86400000)
    )
    .slice(0, 5);

  const greeting = getGreeting();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, {session.user.name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        {showCreate && (
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Link>
        )}
      </div>

      {/* Summary Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <WidgetCard
          icon={<HardHat className="w-5 h-5" />}
          label="Active Phases"
          value={activePhases.length}
          color="blue"
          detail={`${allPhases.length} total`}
        />
        <WidgetCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Overdue"
          value={overduePhases.length}
          color={overduePhases.length > 0 ? "red" : "green"}
          detail={overduePhases.length > 0 ? "needs attention" : "all on track"}
        />
        <WidgetCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Completed"
          value={completedPhases.length}
          color="green"
          detail={`of ${allPhases.length} phases`}
        />
        <WidgetCard
          icon={<FolderKanban className="w-5 h-5" />}
          label="Projects"
          value={projects.length}
          color="purple"
          detail={`${projects.filter((p: { status: string }) => p.status === "ACTIVE").length} active`}
        />
      </div>

      {/* Main content: two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Projects + Overdue + Upcoming */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overdue Alert */}
          {overduePhases.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" />
                Overdue Phases ({overduePhases.length})
              </h3>
              <div className="space-y-2">
                {overduePhases.slice(0, 4).map((phase: { id: string; name: string; estEnd: Date; project: { id: string; name: string }; assignments: { staff: { name: string } }[] }) => {
                  const daysOver = Math.ceil(
                    (now.getTime() - new Date(phase.estEnd).getTime()) / 86400000
                  );
                  return (
                    <Link
                      key={phase.id}
                      href={`/dashboard/projects/${phase.project.id}/phases/${phase.id}`}
                      className="flex items-center justify-between p-2 bg-white rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {phase.name}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {phase.project.name}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-red-600">
                        {daysOver}d overdue
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Starts */}
          {upcomingPhases.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4" />
                Starting Soon (next 2 weeks)
              </h3>
              <div className="space-y-2">
                {upcomingPhases.map((phase: { id: string; name: string; estStart: Date; project: { id: string; name: string }; assignments: { staff: { name: string } }[] }) => (
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
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              Projects
            </h2>
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
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    New Project
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project: typeof projects[number]) => {
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
                      href={`/dashboard/projects/${project.id}/timeline`}
                      className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all"
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
                        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-lg">
                          <HardHat className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="text-sm text-blue-900 font-medium truncate">
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
                                  progress === 100 ? "#16a34a" : "#3b82f6",
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

        {/* Right column: Activity Feed */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
            Recent Activity
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {recentActivity.length === 0 ? (
              <div className="p-6 text-center">
                <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No activity yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Actions like status changes, assignments, and uploads will
                  appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentActivity.map((entry: { id: string; action: string; message: string; createdAt: Date; user: { name: string | null; email: string }; project: { name: string } }) => (
                  <div key={entry.id} className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 shrink-0">
                        {getActivityIcon(entry.action)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900">{entry.message}</p>
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
                ))}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="mt-4 space-y-2">
            <Link
              href="/dashboard/directory"
              className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Users className="w-4 h-4 text-gray-400" />
                Directory
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>
            <Link
              href="/dashboard/notifications"
              className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Activity className="w-4 h-4 text-gray-400" />
                Notifications
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
  color,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "red" | "green" | "purple";
  detail: string;
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    red: "bg-red-50 text-red-600 border-red-100",
    green: "bg-green-50 text-green-600 border-green-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };

  const iconBg = {
    blue: "bg-blue-100 text-blue-600",
    red: "bg-red-100 text-red-600",
    green: "bg-green-100 text-green-600",
    purple: "bg-purple-100 text-purple-600",
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        colorMap[color]
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", iconBg[color])}>{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
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
      return <HardHat className={cn(iconClass, "text-blue-500")} />;
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
