import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { PhaseHeader } from "@/components/phase/PhaseHeader";
import { PhaseInfoSection } from "@/components/phase/PhaseInfoSection";
import { AssignmentSection } from "@/components/phase/AssignmentSection";
import { ChecklistSection } from "@/components/phase/ChecklistSection";
import { DocumentSection } from "@/components/phase/DocumentSection";
import { PhotoSection } from "@/components/phase/PhotoSection";

export default async function PhaseDetailPage({
  params,
}: {
  params: Promise<{ id: string; phaseId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: projectId, phaseId } = await params;

  const phase = await db.phase.findUnique({
    where: { id: phaseId },
    include: {
      project: { select: { id: true, name: true } },
      assignments: {
        include: {
          staff: true,
        },
        orderBy: { assignedAt: "asc" },
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
      photos: {
        include: {
          uploadedBy: { select: { id: true, name: true } },
        },
        orderBy: { takenAt: "desc" },
      },
    },
  });

  if (!phase || phase.project.id !== projectId) notFound();

  // Get all staff for assignment modal
  const allStaff = await db.staff.findMany({
    orderBy: { name: "asc" },
  });

  // Get checklist templates for template picker
  const templates = await db.checklistTemplate.findMany({
    include: { items: { orderBy: { order: "asc" } } },
    orderBy: { name: "asc" },
  });

  const userRole = session.user.role || "VIEWER";
  const canEdit = can(userRole, "update", "phase");
  const canManage = can(userRole, "manage", "phase");

  return (
    <div className="h-full flex flex-col overflow-auto">
      <PhaseHeader
        phase={phase}
        projectId={projectId}
        projectName={phase.project.name}
        canEdit={canEdit}
        canManage={canManage}
      />

      <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-4 sm:space-y-6">
        <PhaseInfoSection phase={phase} canEdit={canEdit} />

        <AssignmentSection
          phaseId={phaseId}
          assignments={phase.assignments}
          allStaff={allStaff}
          canEdit={canEdit}
        />

        <ChecklistSection
          phaseId={phaseId}
          checklist={phase.checklist}
          templates={templates}
          canEdit={canEdit}
          canManage={canManage}
        />

        <DocumentSection
          phaseId={phaseId}
          documents={phase.documents}
          canUpload={can(userRole, "create", "document")}
          canManageStatus={canManage}
        />

        <PhotoSection
          phaseId={phaseId}
          photos={phase.photos}
          canUpload={can(userRole, "create", "photo")}
          canDelete={can(userRole, "delete", "photo")}
        />
      </div>
    </div>
  );
}
