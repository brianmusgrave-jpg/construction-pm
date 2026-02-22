import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  MapPin,
  FileText,
  Camera,
} from "lucide-react";

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; icon: typeof Clock }
> = {
  PENDING: {
    label: "Pending",
    color: "text-gray-600",
    bg: "bg-gray-100",
    icon: Clock,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-blue-700",
    bg: "bg-blue-100",
    icon: AlertCircle,
  },
  REVIEW_REQUESTED: {
    label: "Review Requested",
    color: "text-yellow-700",
    bg: "bg-yellow-100",
    icon: AlertCircle,
  },
  UNDER_REVIEW: {
    label: "Under Review",
    color: "text-purple-700",
    bg: "bg-purple-100",
    icon: Clock,
  },
  COMPLETE: {
    label: "Complete",
    color: "text-green-700",
    bg: "bg-green-100",
    icon: CheckCircle2,
  },
};

export default async function ContractorDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Find all phases this contractor's staff record is assigned to
  // First find staff records linked to this user's email
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });

  // Get projects the contractor is a member of
  const memberships = await db.projectMember.findMany({
    where: { userId: session.user.id },
    include: {
      project: {
        include: {
          phases: {
            include: {
              assignments: {
                include: { staff: true },
              },
              _count: { select: { documents: true, photos: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  // Also find phases assigned via Staff records matching this user's email
  const staffAssignments = await db.phaseAssignment.findMany({
    where: {
      staff: { email: user?.email },
    },
    include: {
      phase: {
        include: {
          project: true,
          _count: { select: { documents: true, photos: true } },
        },
      },
      staff: true,
    },
  });

  // Build a unified list of assigned phases
  type AssignedPhase = {
    id: string;
    name: string;
    status: string;
    detail: string | null;
    projectName: string;
    projectAddress: string | null;
    projectId: string;
    estStart: Date;
    estEnd: Date;
    progress: number;
    docCount: number;
    photoCount: number;
    isOwner: boolean;
  };

  const phaseMap = new Map<string, AssignedPhase>();

  // From project memberships — show all phases in projects they're members of
  for (const m of memberships) {
    for (const phase of m.project.phases) {
      if (!phaseMap.has(phase.id)) {
        const assignment = phase.assignments.find(
          (a) => a.staff.email === user?.email
        );
        phaseMap.set(phase.id, {
          id: phase.id,
          name: phase.name,
          status: phase.status,
          detail: phase.detail,
          projectName: m.project.name,
          projectAddress: m.project.address,
          projectId: m.project.id,
          estStart: phase.estStart,
          estEnd: phase.estEnd,
          progress: phase.progress,
          docCount: phase._count.documents,
          photoCount: phase._count.photos,
          isOwner: assignment?.isOwner ?? false,
        });
      }
    }
  }

  // From direct staff assignments
  for (const a of staffAssignments) {
    if (!phaseMap.has(a.phase.id)) {
      phaseMap.set(a.phase.id, {
        id: a.phase.id,
        name: a.phase.name,
        status: a.phase.status,
        detail: a.phase.detail,
        projectName: a.phase.project.name,
        projectAddress: a.phase.project.address,
        projectId: a.phase.project.id,
        estStart: a.phase.estStart,
        estEnd: a.phase.estEnd,
        progress: a.phase.progress,
        docCount: a.phase._count.documents,
        photoCount: a.phase._count.photos,
        isOwner: a.isOwner,
      });
    }
  }

  const assignedPhases = Array.from(phaseMap.values()).sort((a, b) => {
    // Active work first, then by date
    const statusOrder: Record<string, number> = {
      IN_PROGRESS: 0,
      REVIEW_REQUESTED: 1,
      UNDER_REVIEW: 2,
      PENDING: 3,
      COMPLETE: 4,
    };
    const aOrder = statusOrder[a.status] ?? 5;
    const bOrder = statusOrder[b.status] ?? 5;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.estStart.getTime() - b.estStart.getTime();
  });

  const activeCount = assignedPhases.filter(
    (p) => p.status === "IN_PROGRESS" || p.status === "REVIEW_REQUESTED"
  ).length;
  const completeCount = assignedPhases.filter(
    (p) => p.status === "COMPLETE"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hey, {user?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {activeCount > 0
            ? `You have ${activeCount} active phase${activeCount !== 1 ? "s" : ""}`
            : "No active phases right now"}
          {completeCount > 0 && ` · ${completeCount} completed`}
        </p>
      </div>

      {/* Phase cards */}
      {assignedPhases.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No phases assigned yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Your project manager will assign you to phases as work begins
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignedPhases.map((phase) => {
            const config = statusConfig[phase.status] || statusConfig.PENDING;
            const StatusIcon = config.icon;
            const startStr = phase.estStart.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            const endStr = phase.estEnd.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });

            return (
              <Link
                key={phase.id}
                href={`/contractor/phases/${phase.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-orange-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Project name */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
                        {phase.projectName}
                      </span>
                      {phase.isOwner && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                          Lead
                        </span>
                      )}
                    </div>

                    {/* Phase name */}
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {phase.name}
                    </h3>

                    {/* Detail */}
                    {phase.detail && (
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                        {phase.detail}
                      </p>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>
                        {startStr} — {endStr}
                      </span>
                      {phase.projectAddress && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {phase.projectAddress.split(",")[0]}
                        </span>
                      )}
                      {phase.docCount > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {phase.docCount}
                        </span>
                      )}
                      {phase.photoCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Camera className="w-3 h-3" />
                          {phase.photoCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status + arrow */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 transition-colors" />
                  </div>
                </div>

                {/* Progress bar */}
                {phase.progress > 0 && phase.status !== "COMPLETE" && (
                  <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${phase.progress}%` }}
                    />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
