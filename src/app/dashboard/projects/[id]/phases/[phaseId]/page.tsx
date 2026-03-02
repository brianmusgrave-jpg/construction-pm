/**
 * @file src/app/dashboard/projects/[id]/phases/[phaseId]/page.tsx
 * @description Full phase detail page. Performs 16 parallel data fetches and renders
 * 17 section components covering checklist, documents, photos, budget, dependencies,
 * weather, comments, and more.
 */
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
import { VoiceNoteSection } from "@/components/phase/VoiceNoteSection";
import { getPhaseVoiceNotes } from "@/actions/voiceNotes";
import { PunchListSection } from "@/components/phase/PunchListSection";
import { getPunchListItems } from "@/actions/punchList";
import { RFISection } from "@/components/phase/RFISection";
import { getRFIs } from "@/actions/rfi";
import { SubmittalSection } from "@/components/phase/SubmittalSection";
import { getSubmittals } from "@/actions/submittal";
import { TimeTrackingSection } from "@/components/phase/TimeTrackingSection";
import { getTimeEntries } from "@/actions/timeEntry";
import { LienWaiverSection } from "@/components/phase/LienWaiverSection";
import { getLienWaivers } from "@/actions/lienWaiver";
import { PaymentApplicationSection } from "@/components/phase/PaymentApplicationSection";
import { getPaymentApplications } from "@/actions/paymentApp";
import { DrawingSection } from "@/components/phase/DrawingSection";
import { getDrawings } from "@/actions/drawing";
import { EstimateSection } from "@/components/phase/EstimateSection";
import { getEstimates } from "@/actions/estimate";
import PunchListAIPanel from "@/components/phase/PunchListAIPanel";
import TimeTrackingAIPanel from "@/components/phase/TimeTrackingAIPanel";
import GpsClockPanel from "@/components/phase/GpsClockPanel";

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

  const [comments, voiceNotes, punchListItems, rfiItems, submittalItems, timeEntries, lienWaivers, paymentApps, drawingItems, estimateItems, allStaff, templates, inspections, bids, materials, changeOrders] = await Promise.all([
    getPhaseComments(phaseId),
    getPhaseVoiceNotes(phaseId),
    getPunchListItems(phaseId),
    getRFIs(phaseId),
    getSubmittals(phaseId),
    getTimeEntries(phaseId),
    getLienWaivers(phaseId),
    getPaymentApplications(phaseId),
    getDrawings(phaseId),
    getEstimates(phaseId),
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

        <PunchListSection
          phaseId={phaseId}
          items={punchListItems}
          allStaff={allStaff}
          canEdit={canEdit}
          canManage={canManage}
        />

        {canManage && <PunchListAIPanel projectId={projectId} phaseId={phaseId} />}

        <RFISection
          phaseId={phaseId}
          rfis={rfiItems}
          allStaff={allStaff}
          canEdit={canEdit}
          canManage={canManage}
        />

        <SubmittalSection
          phaseId={phaseId}
          submittals={submittalItems}
          allStaff={allStaff}
          canEdit={canEdit}
          canManage={canManage}
        />

        <TimeTrackingSection
          phaseId={phaseId}
          entries={timeEntries}
          allStaff={allStaff}
          canEdit={canEdit}
          canManage={canManage}
        />

        {canManage && <TimeTrackingAIPanel projectId={projectId} />}

        {canEdit && (
          <GpsClockPanel phaseId={phaseId} />
        )}

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

        <LienWaiverSection
          phaseId={phaseId}
          waivers={lienWaivers}
          canEdit={canEdit}
          canManage={canManage}
        />

        <PaymentApplicationSection
          phaseId={phaseId}
          applications={paymentApps}
          canEdit={canEdit}
          canManage={canManage}
        />

        <DrawingSection
          phaseId={phaseId}
          drawings={drawingItems}
          canEdit={canEdit}
          canManage={canManage}
        />

        <EstimateSection
          phaseId={phaseId}
          estimates={estimateItems}
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
          canFlag={canManage}
        />

        <VoiceNoteSection
          phaseId={phaseId}
          voiceNotes={voiceNotes}
          currentUserId={session.user.id}
          isAdmin={(session.user as any).role === "ADMIN"}
          canRecord={canEdit}
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
