import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { GanttChart } from "@/components/timeline/GanttChart";
import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { cn, statusColor, statusLabel, fmtLong, weeksBetween } from "@/lib/utils";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      phases: {
        include: {
          assignments: {
            include: {
              staff: { select: { id: true, name: true, company: true } },
            },
          },
          _count: { select: { documents: true, photos: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  if (!project) notFound();

  // Calculate summary stats
  const lastEstPhase = project.phases
    .filter((p: typeof project.phases[0]) => !p.isMilestone)
    .sort((a: typeof project.phases[0], b: typeof project.phases[0]) => b.estEnd.getTime() - a.estEnd.getTime())[0];

  const lastWorstPhase = project.phases
    .filter((p: typeof project.phases[0]) => !p.isMilestone && p.worstEnd)
    .sort((a: typeof project.phases[0], b: typeof project.phases[0]) => (b.worstEnd?.getTime() || 0) - (a.worstEnd?.getTime() || 0))[0];

  const planApproval = project.planApproval || project.createdAt;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-bold text-gray-900">
                {project.name}
              </h1>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  statusColor(project.status)
                )}
              >
                {statusLabel(project.status)}
              </span>
            </div>
            {project.planApproval && (
              <p className="text-sm text-gray-500 mt-1 ml-8">
                Plans Confirmed {fmtLong(project.planApproval)}
              </p>
            )}
          </div>

          {/* Current date */}
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Current Date
            </p>
            <p className="text-sm font-medium text-green-600">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="flex-1 overflow-auto">
        <GanttChart
          projectId={project.id}
          phases={project.phases}
          planApproval={planApproval}
        />
      </div>

      {/* Summary Cards */}
      {lastEstPhase && (
        <div className="border-t border-gray-200 bg-white px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Estimated Completion"
              date={lastEstPhase.estEnd}
              planApproval={planApproval}
              color="blue"
            />
            {lastWorstPhase?.worstEnd && (
              <SummaryCard
                label="Worst Case Completion"
                date={lastWorstPhase.worstEnd}
                planApproval={planApproval}
                color="red"
              />
            )}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Phases
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {project.phases.filter((p: typeof project.phases[0]) => p.status === "COMPLETE").length}/
                {project.phases.length}
              </p>
              <p className="text-xs text-gray-500">completed</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Team
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {project.members.length}
              </p>
              <p className="text-xs text-gray-500">members</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  date,
  planApproval,
  color,
}: {
  label: string;
  date: Date;
  planApproval: Date;
  color: "blue" | "red";
}) {
  const weeks = weeksBetween(planApproval, date);
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold",
          color === "blue" ? "text-blue-600" : "text-red-600"
        )}
      >
        {fmtLong(date)}
      </p>
      <p className="text-xs text-gray-500">~{weeks} weeks from approval</p>
    </div>
  );
}
