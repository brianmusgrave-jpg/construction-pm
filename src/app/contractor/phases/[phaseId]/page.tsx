import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Calendar } from "lucide-react";
import { ChecklistSection } from "@/components/phase/ChecklistSection";
import { DocumentSection } from "@/components/phase/DocumentSection";

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  PENDING: { label: "Pending", color: "text-gray-600", bg: "bg-gray-100" },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-blue-700",
    bg: "bg-blue-100",
  },
  REVIEW_REQUESTED: {
    label: "Review Requested",
    color: "text-yellow-700",
    bg: "bg-yellow-100",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    color: "text-purple-700",
    bg: "bg-purple-100",
  },
  COMPLETE: {
    label: "Complete",
    color: "text-green-700",
    bg: "bg-green-100",
  },
};

export default async function ContractorPhaseDetail({
  params,
}: {
  params: Promise<{ phaseId: string }>;
}) {
  const { phaseId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const phase = await db.phase.findUnique({
    where: { id: phaseId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          address: true,
          members: { where: { userId: session.user.id } },
        },
      },
      checklist: {
        include: {
          items: {
            include: {
              completedBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: { order: "asc" },
          },
        },
      },
      documents: {
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      assignments: {
        include: { staff: true },
      },
    },
  });

  if (!phase) notFound();

  // Verify this contractor has access (member of the project)
  if (phase.project.members.length === 0) {
    redirect("/contractor");
  }

  const config = statusConfig[phase.status] || statusConfig.PENDING;

  const startStr = phase.estStart.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const endStr = phase.estEnd.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/contractor"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to My Work
      </Link>

      {/* Phase header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              {phase.project.name}
            </p>
            <h1 className="text-xl font-bold text-gray-900">{phase.name}</h1>
            {phase.detail && (
              <p className="text-sm text-gray-600 mt-1">{phase.detail}</p>
            )}
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${config.bg} ${config.color}`}
          >
            {config.label}
          </span>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {startStr} — {endStr}
          </span>
          {phase.project.address && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {phase.project.address}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {phase.progress > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Progress</span>
              <span>{phase.progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all"
                style={{ width: `${phase.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Checklist */}
      <ChecklistSection
        phaseId={phase.id}
        checklist={phase.checklist}
        templates={[]}
        canEdit={true}
        canManage={false}
      />

      {/* Documents */}
      <DocumentSection
        phaseId={phase.id}
        documents={phase.documents}
        canUpload={true}
        canManageStatus={false}
      />
    </div>
  );
}
