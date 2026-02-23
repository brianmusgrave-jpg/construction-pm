// Offline replay handler registry — maps queued action names to server action calls.
// Import this file once at the app level to register all handlers.
//
// Each handler receives the payload that was saved when the mutation was queued,
// and calls the corresponding server action to replay it.

import { registerOfflineAction } from "@/hooks/useOfflineSync";

// Phase actions
import { updatePhaseStatus, updatePhaseDates } from "@/actions/phases";
// Checklist actions
import { toggleChecklistItem, addCustomChecklistItem, deleteChecklistItem } from "@/actions/checklists";
// Comment actions
import { addPhaseComment, deletePhaseComment } from "@/actions/comments";
// Budget actions
import { updateProjectBudget, updatePhaseCosts } from "@/actions/budget";
// Change order actions
import { createChangeOrder, updateChangeOrderStatus, deleteChangeOrder } from "@/actions/change-orders";
// Daily log actions
import { createDailyLog, deleteDailyLog } from "@/actions/daily-logs";
// Photo actions
import { updatePhotoCaption, flagPhoto, clearPhotoFlag, updatePhotoGps } from "@/actions/photos";
// Document actions
import { updateDocumentStatus } from "@/actions/documents";
// Inspection actions
import { createInspection, recordInspectionResult } from "@/actions/inspections";
// Material actions
import { createMaterial, updateMaterialStatus } from "@/actions/materials";
// Staff actions
import { assignStaffToPhase, unassignStaffFromPhase } from "@/actions/phases";
// Notification actions
import { markAsRead, markAllAsRead } from "@/actions/notifications";

// Type aliases matching server action parameter types
type PhotoFlagType =
  | "REPLACEMENT_NEEDED"
  | "ADDITIONAL_ANGLES"
  | "ADDITIONAL_PHOTOS"
  | "CLARIFICATION_NEEDED";

type DocStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
type MaterialStatus = "ORDERED" | "DELIVERED" | "INSTALLED" | "RETURNED";
type InspectionResult = "PASS" | "FAIL" | "CONDITIONAL";

export function registerAllOfflineHandlers(): void {
  // ── Phase mutations ──
  registerOfflineAction("updatePhaseStatus", async (p) => {
    await updatePhaseStatus(p.phaseId as string, p.status as string);
  });

  registerOfflineAction("updatePhaseDates", async (p) => {
    await updatePhaseDates({
      phaseId: p.phaseId as string,
      estStart: p.estStart as string,
      estEnd: p.estEnd as string,
      worstStart: p.worstStart as string | null | undefined,
      worstEnd: p.worstEnd as string | null | undefined,
    });
  });

  registerOfflineAction("assignStaff", async (p) => {
    await assignStaffToPhase(
      p.phaseId as string,
      p.staffId as string,
      (p.isOwner as boolean) ?? false
    );
  });

  registerOfflineAction("unassignStaff", async (p) => {
    await unassignStaffFromPhase(p.assignmentId as string);
  });

  // ── Checklist mutations ──
  registerOfflineAction("toggleChecklistItem", async (p) => {
    await toggleChecklistItem(p.itemId as string);
  });

  registerOfflineAction("addChecklistItem", async (p) => {
    await addCustomChecklistItem(p.checklistId as string, p.text as string);
  });

  registerOfflineAction("deleteChecklistItem", async (p) => {
    await deleteChecklistItem(p.itemId as string);
  });

  // ── Comment mutations ──
  registerOfflineAction("addComment", async (p) => {
    await addPhaseComment({
      phaseId: p.phaseId as string,
      content: p.content as string,
    });
  });

  registerOfflineAction("deleteComment", async (p) => {
    await deletePhaseComment(p.commentId as string);
  });

  // ── Budget mutations ──
  registerOfflineAction("updateProjectBudget", async (p) => {
    await updateProjectBudget(p.projectId as string, p.budget as number | null);
  });

  registerOfflineAction("updatePhaseCosts", async (p) => {
    await updatePhaseCosts(p.phaseId as string, {
      estimatedCost: p.estimatedCost as number | null | undefined,
      actualCost: p.actualCost as number | null | undefined,
    });
  });

  // ── Change order mutations ──
  registerOfflineAction("createChangeOrder", async (p) => {
    await createChangeOrder({
      phaseId: p.phaseId as string,
      number: p.number as string,
      title: p.title as string,
      description: p.description as string | undefined,
      amount: p.amount as number | undefined,
      reason: p.reason as string | undefined,
    });
  });

  registerOfflineAction("updateChangeOrderStatus", async (p) => {
    await updateChangeOrderStatus(
      p.changeOrderId as string,
      p.status as "APPROVED" | "REJECTED"
    );
  });

  registerOfflineAction("deleteChangeOrder", async (p) => {
    await deleteChangeOrder(p.changeOrderId as string);
  });

  // ── Daily log mutations ──
  registerOfflineAction("createDailyLog", async (p) => {
    await createDailyLog({
      projectId: p.projectId as string,
      date: p.date as string,
      weather: p.weather as string | undefined,
      tempHigh: p.tempHigh as number | undefined,
      tempLow: p.tempLow as number | undefined,
      crewCount: p.crewCount as number | undefined,
      equipment: p.equipment as string | undefined,
      workSummary: p.workSummary as string,
      issues: p.issues as string | undefined,
      notes: p.notes as string | undefined,
    });
  });

  registerOfflineAction("deleteDailyLog", async (p) => {
    await deleteDailyLog(p.logId as string);
  });

  // ── Photo mutations ──
  registerOfflineAction("updatePhotoCaption", async (p) => {
    await updatePhotoCaption(p.photoId as string, p.caption as string);
  });

  registerOfflineAction("flagPhoto", async (p) => {
    await flagPhoto(
      p.photoId as string,
      p.flagType as PhotoFlagType,
      p.note as string | undefined
    );
  });

  registerOfflineAction("clearPhotoFlag", async (p) => {
    await clearPhotoFlag(p.photoId as string);
  });

  registerOfflineAction("updatePhotoGps", async (p) => {
    await updatePhotoGps(
      p.photoId as string,
      p.latitude as number,
      p.longitude as number
    );
  });

  // ── Document mutations ──
  registerOfflineAction("updateDocumentStatus", async (p) => {
    await updateDocumentStatus(p.documentId as string, p.status as DocStatus);
  });

  // ── Inspection mutations ──
  registerOfflineAction("createInspection", async (p) => {
    await createInspection({
      phaseId: p.phaseId as string,
      title: p.title as string,
      inspectorName: p.inspectorName as string | undefined,
      scheduledAt: p.scheduledAt as string,
      notifyOnResult: p.notifyOnResult as boolean | undefined,
    });
  });

  registerOfflineAction("recordInspectionResult", async (p) => {
    await recordInspectionResult(
      p.inspectionId as string,
      p.result as InspectionResult,
      p.notes as string | undefined
    );
  });

  // ── Material mutations ──
  registerOfflineAction("createMaterial", async (p) => {
    await createMaterial({
      phaseId: p.phaseId as string,
      name: p.name as string,
      quantity: p.quantity as number,
      unit: p.unit as string,
      cost: p.cost as number | undefined,
      supplier: p.supplier as string | undefined,
      notes: p.notes as string | undefined,
    });
  });

  registerOfflineAction("updateMaterialStatus", async (p) => {
    await updateMaterialStatus(
      p.materialId as string,
      p.status as MaterialStatus
    );
  });

  // ── Notification mutations (low priority but nice for offline) ──
  registerOfflineAction("markNotificationRead", async (p) => {
    await markAsRead(p.notificationId as string);
  });

  registerOfflineAction("markAllNotificationsRead", async () => {
    await markAllAsRead();
  });
}
