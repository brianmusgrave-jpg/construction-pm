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
} from "lucide-react";
import { cn, statusColor, statusLabel, fmtShort, fmtLong, fmtRelative } from "@/lib/utils";

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
        take: 10,
      })
      .catch(() => [] as never[]),
  ]);

  if (!project) notFound();

  const now = new Date();
  const phases = project.phases;

  // Compute stats
  const activePhases = phases.filter(
    (p) =>
      p.status === "IN_PROGRESS" ||
      p.status === "REVIEW_REQUESTED" ||
      p.status === "UNDER_REVIEW"
  );
  const completedPhases = phases.filter((p) => p.status === "COMPLETE");
  const overduePhases = phases.filter(
    (p) => p.status !== "COMPLETE" && new Date(p.estEnd) < now
  );
  const reviewPhases = phases.filter((p) => p.status === "REVIEW_REQUESTED");
  const overallProgress =
    phases.length > 0
      ? Math.round((completedPhases.length / phases.length) * 100)
      : 0;

  // Checklist stats
  const allChecklistItems = phases.flatMap(
    (p) => p.checklist?.items || []
  );
  const completedChecklistItems = allChecklistItems.filter((i) => i.completed);
  const checklistPercent =
    allChecklistItems.length > 0
      ? Math.round(
          (completedChecklistItems.length / allChecklistItems.length) * 100
        )
      : 0;

  // Document and photo counts
  const totalDocs = phases.reduce((sum, p) => sum + p._count.documents, 0);
  const totalPhotos = phases.reduce((sum, p) => sum + p._count.photos, 0);

  // Budget formatting
  const budgetStr = project.budget
    ? `$${Number(project.budget).toLocaleString()}`
    : null;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
              {project.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {project.address}
                </span>
              )}
              {budgetStr && (
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  {budgetStr}
                </span>
              )}
              {project.estCompletion && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Est. {fmtLong(project.estCompletion)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span
              className={cn(
                "text-xs font-medium px-3 py-1 rounded-full",
                statusColor(project.status)
              )}
            >
              {statusLabel(project.status)}
            </span>
            <Link
              href={`/dashboard/projects/${id}/timeline`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Timeline
            </Link>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Overall Progress
          </span>
          <span className="text-sm font-bold text-gray-900">
            {overallProgress}%
          </span>
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
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>
            {completedPhases.length} of {phases.length} phases complete
          </span>
          {project.estCompletion && (
            <span>Target: {fmtShort(project.estCompletion)}</span>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
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

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left: Phase list */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Phases
          </h2>
          <div className="space-y-2">
            {phases.map((phase) => {
              const isOverdue =
                phase.status !== "COMPLETE" && new Date(phase.estEnd) < now;
              const checkItems = phase.checklist?.items || [];
              const checkDone = checkItems.filter((i) => i.completed).length;
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
          <div>
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              Team ({project.members.length})
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {project.members.map(
                (member: {
                  id: string;
                  role: string;
                  user: {
                    id: string;
                    name: string | null;
                    email: string;
                    role: string;
                    image: string | null;
                  };
                }) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary-bg)] text-[var(--color-primary)] flex items-center justify-center text-sm font-semibold shrink-0">
                      {(member.user.name || member.user.email)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.user.name || member.user.email}
                      </p>
                      <p className="text-xs text-gray-500">
                        {statusLabel(member.role)}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Activity */}
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
                  {recentActivity.map(
                    (entry: {
                      id: string;
                      action: string;
                      message: string;
                      createdAt: Date;
                      user: { name: string | null; email: string };
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
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──

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
}) {
  const colors = {
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
  const c = "w-4 h-4";
  switch (action) {
    case "PHASE_STATUS_CHANGED":
      return <HardHat className={cn(c, "text-[var(--color-primary)]")} />;
    case "PHASE_CREATED":
      return <TrendingUp className={cn(c, "text-green-500")} />;
    case "STAFF_ASSIGNED":
    case "STAFF_UNASSIGNED":
      return <Users className={cn(c, "text-purple-500")} />;
    case "CHECKLIST_APPLIED":
    case "CHECKLIST_ITEM_TOGGLED":
      return <ClipboardCheck className={cn(c, "text-green-500")} />;
    case "DOCUMENT_UPLOADED":
    case "DOCUMENT_STATUS_CHANGED":
      return <FileText className={cn(c, "text-amber-500")} />;
    case "PHOTO_UPLOADED":
      return <Camera className={cn(c, "text-pink-500")} />;
    default:
      return <Activity className={cn(c, "text-gray-400")} />;
  }
}
