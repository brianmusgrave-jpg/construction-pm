import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getProjectHealthReport,
  getPhaseStatusBreakdown,
  getDocumentStats,
  getActivityTimeline,
  getTeamPerformance,
  getOverdueReport,
} from "@/actions/reports";
import { cn, statusColor, statusLabel, fmtShort } from "@/lib/utils";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Users,
  Activity,
  ChevronRight,
  Shield,
  HardHat,
  Camera,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const isAdmin = role === "ADMIN";
  const isPM = role === "PROJECT_MANAGER";

  // If not admin or PM, show read-only stakeholder view
  const canManage = isAdmin || isPM;

  const [
    projectHealth,
    phaseBreakdown,
    documentStats,
    activityTimeline,
    teamPerformance,
    overdueReport,
  ] = await Promise.all([
    getProjectHealthReport(),
    getPhaseStatusBreakdown(),
    getDocumentStats(),
    getActivityTimeline(30),
    canManage ? getTeamPerformance() : Promise.resolve([]),
    getOverdueReport(),
  ]);

  const totalPhases = phaseBreakdown.reduce((s, p) => s + p.count, 0);
  const completedPhases =
    phaseBreakdown.find((p) => p.status === "COMPLETE")?.count || 0;
  const overallProgress =
    totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[var(--color-primary)]" />
            Reports &amp; Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin
              ? "Organization-wide overview"
              : isPM
              ? "Your project portfolio"
              : "Project overview"}
            {" · "}Last 30 days
          </p>
        </div>
        {isAdmin && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
            <Shield className="w-3.5 h-3.5" />
            Admin View
          </span>
        )}
      </div>

      {/* Top-level KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Overall Progress"
          value={`${overallProgress}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="blue"
          detail={`${completedPhases}/${totalPhases} phases done`}
        />
        <KpiCard
          label="Projects"
          value={projectHealth.length}
          icon={<HardHat className="w-5 h-5" />}
          color="blue"
          detail={`${projectHealth.filter((p) => p.health === "on-track").length} on track`}
        />
        <KpiCard
          label="Overdue"
          value={overdueReport.length}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={overdueReport.length > 0 ? "red" : "green"}
          detail={
            overdueReport.length > 0
              ? `Avg ${Math.round(overdueReport.reduce((s, o) => s + o.daysOverdue, 0) / overdueReport.length)}d behind`
              : "All on schedule"
          }
        />
        <KpiCard
          label="Activity"
          value={activityTimeline.totalActions}
          icon={<Activity className="w-5 h-5" />}
          color="purple"
          detail="Actions this month"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Phase Status Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
              Phase Status Distribution
            </h2>
            <div className="space-y-3">
              {phaseBreakdown.map((item) => {
                const pct =
                  totalPhases > 0
                    ? Math.round((item.count / totalPhases) * 100)
                    : 0;
                return (
                  <div key={item.status} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full w-32 text-center shrink-0",
                        statusColor(item.status)
                      )}
                    >
                      {statusLabel(item.status)}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                      <div
                        className={cn("h-2.5 rounded-full transition-all", barColor(item.status))}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-14 text-right">
                      {item.count}{" "}
                      <span className="text-xs text-gray-400">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project Health Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                Project Health
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-5 py-2.5 font-medium text-gray-600">
                      Project
                    </th>
                    <th className="px-3 py-2.5 font-medium text-gray-600 text-center">
                      Status
                    </th>
                    <th className="px-3 py-2.5 font-medium text-gray-600 text-center hidden sm:table-cell">
                      Phases
                    </th>
                    <th className="px-3 py-2.5 font-medium text-gray-600 text-center">
                      Progress
                    </th>
                    <th className="px-3 py-2.5 font-medium text-gray-600 text-center">
                      Health
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {projectHealth.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="font-medium text-gray-900 hover:text-[var(--color-primary)]"
                        >
                          {project.name}
                        </Link>
                        {project.address && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {project.address}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            statusColor(project.status)
                          )}
                        >
                          {statusLabel(project.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <span className="text-gray-700">
                          {project.phases.completed}/{project.phases.total}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-[var(--color-primary)]"
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">
                            {project.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <HealthBadge health={project.health} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overdue Report */}
          {overdueReport.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-red-100 bg-red-50">
                <h2 className="text-sm font-semibold text-red-800 uppercase tracking-wide flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Overdue Phases ({overdueReport.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {overdueReport.map((phase) => (
                  <Link
                    key={phase.id}
                    href={`/dashboard/projects/${phase.projectId}/phases/${phase.id}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-red-50/30 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {phase.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {phase.projectName} · {phase.owner}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-semibold text-red-600">
                        {phase.daysOverdue}d
                      </span>
                      <p className="text-xs text-gray-400">
                        Due {fmtShort(phase.estEnd)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-12 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-red-500"
                          style={{ width: `${phase.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {phase.progress}%
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-500 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Document Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
              Documents
            </h2>
            <div className="text-center mb-4">
              <p className="text-3xl font-bold text-gray-900">
                {documentStats.total}
              </p>
              <p className="text-xs text-gray-500">Total documents</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                By Status
              </p>
              {documentStats.byStatus.map((s) => (
                <div key={s.status} className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      statusColor(s.status)
                    )}
                  >
                    {statusLabel(s.status)}
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
            {documentStats.byCategory.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                  By Category
                </p>
                {documentStats.byCategory.map((c) => (
                  <div
                    key={c.category}
                    className="flex items-center justify-between"
                  >
                    <span className="text-xs text-gray-600">
                      {statusLabel(c.category)}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      {c.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
              Activity Breakdown
            </h2>
            {activityTimeline.byAction.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No activity recorded yet
              </p>
            ) : (
              <div className="space-y-2">
                {activityTimeline.byAction.slice(0, 8).map((a) => (
                  <div
                    key={a.action}
                    className="flex items-center justify-between"
                  >
                    <span className="text-xs text-gray-600 truncate">
                      {formatAction(a.action)}
                    </span>
                    <span className="text-sm font-medium text-gray-700 shrink-0 ml-2">
                      {a.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Sparkline (text-based) */}
          {activityTimeline.daily.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                Daily Activity (30d)
              </h2>
              <div className="flex items-end gap-[2px] h-16">
                {(() => {
                  const max = Math.max(
                    ...activityTimeline.daily.map((d) => d.count),
                    1
                  );
                  return activityTimeline.daily.slice(-30).map((d, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-[var(--color-primary)] rounded-t opacity-70 hover:opacity-100 transition-opacity"
                      style={{
                        height: `${Math.max((d.count / max) * 100, 4)}%`,
                      }}
                      title={`${d.date}: ${d.count} actions`}
                    />
                  ));
                })()}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-400">30d ago</span>
                <span className="text-[10px] text-gray-400">Today</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Team Performance — admin/PM only */}
      {canManage && (teamPerformance as ReturnType<typeof Array>).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              Team Performance
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-2.5 font-medium text-gray-600">
                    Name
                  </th>
                  <th className="px-3 py-2.5 font-medium text-gray-600 hidden sm:table-cell">
                    Company
                  </th>
                  <th className="px-3 py-2.5 font-medium text-gray-600 text-center">
                    Assigned
                  </th>
                  <th className="px-3 py-2.5 font-medium text-gray-600 text-center">
                    Completed
                  </th>
                  <th className="px-3 py-2.5 font-medium text-gray-600 text-center">
                    Active
                  </th>
                  <th className="px-3 py-2.5 font-medium text-gray-600 text-center">
                    Overdue
                  </th>
                  <th className="px-3 py-2.5 font-medium text-gray-600 text-center hidden sm:table-cell">
                    Lead
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(teamPerformance as Awaited<ReturnType<typeof getTeamPerformance>>).map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.role}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-600 hidden sm:table-cell">
                      {member.company || "—"}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-700">
                      {member.totalAssignments}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-green-600 font-medium">
                        {member.completed}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-blue-600 font-medium">
                        {member.active}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {member.overdue > 0 ? (
                        <span className="text-red-600 font-medium">
                          {member.overdue}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      {member.isOwnerCount > 0 ? (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {member.isOwnerCount}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper Components ──

function KpiCard({
  label,
  value,
  icon,
  color,
  detail,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: "blue" | "red" | "green" | "purple";
  detail: string;
}) {
  const colorMap = {
    blue: "bg-[var(--color-primary-bg)] text-[var(--color-primary)] border-[var(--color-primary-bg)]",
    red: "bg-red-50 text-red-600 border-red-100",
    green: "bg-green-50 text-green-600 border-green-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };
  const iconBg = {
    blue: "bg-[var(--color-primary-bg)] text-[var(--color-primary)]",
    red: "bg-red-100 text-red-600",
    green: "bg-green-100 text-green-600",
    purple: "bg-purple-100 text-purple-600",
  };

  return (
    <div className={cn("rounded-xl border p-4", colorMap[color])}>
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

function HealthBadge({ health }: { health: string }) {
  if (health === "on-track") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" />
        On Track
      </span>
    );
  }
  if (health === "at-risk") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        <AlertTriangle className="w-3 h-3" />
        At Risk
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" />
      Not Started
    </span>
  );
}

function barColor(status: string): string {
  switch (status) {
    case "COMPLETE":
      return "bg-green-500";
    case "IN_PROGRESS":
      return "bg-blue-500";
    case "REVIEW_REQUESTED":
      return "bg-amber-500";
    case "UNDER_REVIEW":
      return "bg-purple-500";
    case "PENDING":
      return "bg-gray-400";
    default:
      return "bg-gray-400";
  }
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
