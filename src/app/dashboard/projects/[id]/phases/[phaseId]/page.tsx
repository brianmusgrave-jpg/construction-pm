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
import { CommentSection } from "@/components/phase/CommentSection";
import { InspectionSection } from "@/components/phase/InspectionSection";
import { SubcontractorBidSection } from "@/components/phase/SubcontractorBidSection";
import { MaterialSection } from "@/components/phase/MaterialSection";
import { ChangeOrderSection } from "@/components/phase/ChangeOrderSection";
import { getPhaseComments } from "@/actions/comments";

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
          flaggedBy: { select: { name: true } },
        },
        orderBy: { takenAt: "desc" },
      },
    },
  });

  if (!phase || phase.project.id !== projectId) notFound();

  const dbc = db as any;

  const [comments, allStaff, templates, inspections, bids, materials, changeOrders] = await Promise.all([
    getPhaseComments(phaseId),
    db.staff.findMany({ orderBy: { name: "asc" } }),
    db.checklistTemplate.findMany({
      include: { items: { orderBy: { order: "asc" } } },
      orderBy: { name: "asc" },
    }),
    dbc.inspection.findMany({
      where: { phaseId },
      orderBy: { scheduledDate: "asc" },
    }).catch(() => []),
    dbc.subcontractorBid.findMany({
      where: { phaseId },
      orderBy: { createdAt: "asc" },
    }).catch(() => []),
    dbc.material.findMany({
      where: { phaseId },
      orderBy: { createdAt: "asc" },
    }).then((mats: any[]) =>
      mats.map((m: any) => ({ ...m, cost: m.cost ? Number(m.cost) : null }))
    ).catch(() => []),
    dbc.changeOrder.findMany({
      where: { phaseId },
      orderBy: { createdAt: "desc" },
    }).then((cos: any[]) =>
      cos.map((co: any) => ({ ...co, amount: co.amount ? Number(co.amount) : null }))
    ).catch(() => []),
  ]);

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

        <InspectionSection
          phaseId={phaseId}
          inspections={inspections}
          canCreate={canEdit}
          canRecord={canEdit}
        />

        <SubcontractorBidSection
          phaseId={phaseId}
          bids={bids}
          canManage={canManage}
        />

        <MaterialSection
          phaseId={phaseId}
          materials={materials}
          canManage={canManage}
        />

        <ChangeOrderSection
          phaseId={phaseId}
          changeOrders={changeOrders}
          canCreate={canEdit}
          canApprove={canManage}
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
          canFlag={canManage}
        />

        <CommentSection
          phaseId={phaseId}
          comments={comments}
          currentUserId={session.user.id}
          isAdmin={(session.user as any).role === "ADMIN"}
        />
      </div>
    </div>
  );
}
