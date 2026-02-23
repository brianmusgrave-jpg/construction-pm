// Background sync endpoint — receives batched offline mutations from the
// service worker or client-side sync logic and replays them server-side.
//
// POST /api/sync
// Body: { mutations: Array<{ action: string, payload: Record<string, unknown>, timestamp: number }> }
// Returns: { results: Array<{ action: string, status: "ok" | "error", error?: string }>, synced: number, failed: number }

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimitHeaders } from "@/lib/rate-limit";

// Server action imports
import { updatePhaseStatus, updatePhaseDates } from "@/actions/phases";
import { toggleChecklistItem, addCustomChecklistItem } from "@/actions/checklists";
import { addPhaseComment } from "@/actions/comments";
import { createDailyLog } from "@/actions/daily-logs";
import { createInspection, recordInspectionResult } from "@/actions/inspections";
import { createMaterial, updateMaterialStatus } from "@/actions/materials";
import { flagPhoto } from "@/actions/photos";
import { updateDocumentStatus } from "@/actions/documents";
import { createChangeOrder, updateChangeOrderStatus } from "@/actions/change-orders";
import { updateProjectBudget, updatePhaseCosts } from "@/actions/budget";
import { addPhaseDependency, removePhaseDependency } from "@/actions/dependencies";
import { createSubcontractorBid } from "@/actions/subcontractor-bids";

type PhotoFlagType = "REPLACEMENT_NEEDED" | "ADDITIONAL_ANGLES" | "ADDITIONAL_PHOTOS" | "CLARIFICATION_NEEDED";
type DocStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
type MaterialStatus = "ORDERED" | "DELIVERED" | "INSTALLED" | "RETURNED";
type InspectionResult = "PASS" | "FAIL" | "CONDITIONAL";
type ChangeOrderStatus = "APPROVED" | "REJECTED";

interface SyncMutation {
  action: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

interface SyncResult {
  action: string;
  timestamp: number;
  status: "ok" | "error";
  error?: string;
}

// Action dispatcher — maps action names to server action calls
async function dispatchAction(action: string, p: Record<string, unknown>): Promise<void> {
  switch (action) {
    case "updatePhaseStatus":
      await updatePhaseStatus(p.phaseId as string, p.status as string);
      break;
    case "updatePhaseDates":
      await updatePhaseDates({
        phaseId: p.phaseId as string,
        estStart: p.estStart as string,
        estEnd: p.estEnd as string,
        worstStart: p.worstStart as string | null | undefined,
        worstEnd: p.worstEnd as string | null | undefined,
      });
      break;
    case "toggleChecklistItem":
      await toggleChecklistItem(p.itemId as string);
      break;
    case "addChecklistItem":
      await addCustomChecklistItem(p.checklistId as string, p.title as string);
      break;
    case "addComment":
      await addPhaseComment({
        phaseId: p.phaseId as string,
        content: p.content as string,
      });
      break;
    case "createDailyLog":
      await createDailyLog({
        projectId: p.projectId as string,
        date: p.date as string,
        weather: (p.weather as string) || undefined,
        tempHigh: p.tempHigh as number | undefined,
        tempLow: p.tempLow as number | undefined,
        crewCount: p.crewCount as number | undefined,
        equipment: (p.equipment as string) || undefined,
        workSummary: p.workSummary as string,
        issues: (p.issues as string) || undefined,
        notes: (p.notes as string) || undefined,
      });
      break;
    case "createInspection":
      await createInspection({
        phaseId: p.phaseId as string,
        title: p.title as string,
        inspectorName: (p.inspectorName as string) || undefined,
        scheduledAt: p.scheduledAt as string,
        notifyOnResult: (p.notifyOnResult as boolean) || undefined,
      });
      break;
    case "recordInspectionResult":
      await recordInspectionResult(
        p.inspectionId as string,
        p.result as InspectionResult,
        (p.notes as string) || undefined
      );
      break;
    case "createMaterial":
      await createMaterial({
        phaseId: p.phaseId as string,
        name: p.name as string,
        quantity: p.quantity as number,
        unit: p.unit as string,
        cost: p.cost as number | undefined,
        supplier: (p.supplier as string) || undefined,
        notes: (p.notes as string) || undefined,
      });
      break;
    case "updateMaterialStatus":
      await updateMaterialStatus(
        p.materialId as string,
        p.status as MaterialStatus
      );
      break;
    case "flagPhoto":
      await flagPhoto(
        p.photoId as string,
        p.flagType as PhotoFlagType,
        (p.flagNote as string) || undefined
      );
      break;
    case "updateDocumentStatus":
      await updateDocumentStatus(
        p.documentId as string,
        p.status as DocStatus
      );
      break;
    case "createChangeOrder":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await createChangeOrder(p as any);
      break;
    case "updateChangeOrderStatus":
      await updateChangeOrderStatus(
        p.changeOrderId as string,
        p.status as ChangeOrderStatus
      );
      break;
    case "updateProjectBudget":
      await updateProjectBudget(
        p.projectId as string,
        p.budget as number
      );
      break;
    case "updatePhaseCosts":
      await updatePhaseCosts(
        p.phaseId as string,
        {
          estimatedCost: p.estimatedCost as number | null | undefined,
          actualCost: p.actualCost as number | null | undefined,
        }
      );
      break;
    case "addDependency":
      await addPhaseDependency({
        phaseId: p.phaseId as string,
        dependsOnId: p.dependsOnId as string,
        lagDays: (p.lagDays as number) || undefined,
      });
      break;
    case "removeDependency":
      await removePhaseDependency({ dependencyId: p.dependencyId as string });
      break;
    case "submitBid":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await createSubcontractorBid(p as any);
      break;
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export async function POST(request: NextRequest) {
  // Rate limit: 20 sync requests per minute per IP
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const rl = rateLimitHeaders(`sync:${ip}`, 20, 60_000);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: rl.headers }
    );
  }

  // Authenticate
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Parse body
  let body: { mutations?: SyncMutation[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const mutations = body.mutations;
  if (!Array.isArray(mutations) || mutations.length === 0) {
    return NextResponse.json(
      { error: "mutations must be a non-empty array" },
      { status: 400 }
    );
  }

  // Cap batch size to prevent abuse
  const MAX_BATCH_SIZE = 50;
  if (mutations.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` },
      { status: 400 }
    );
  }

  // Sort by timestamp (oldest first) for causal ordering
  const sorted = [...mutations].sort((a, b) => a.timestamp - b.timestamp);

  // Process each mutation sequentially to preserve ordering
  const results: SyncResult[] = [];
  let synced = 0;
  let failed = 0;

  for (const mutation of sorted) {
    try {
      await dispatchAction(mutation.action, mutation.payload);
      results.push({
        action: mutation.action,
        timestamp: mutation.timestamp,
        status: "ok",
      });
      synced++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      results.push({
        action: mutation.action,
        timestamp: mutation.timestamp,
        status: "error",
        error: errorMsg,
      });
      failed++;
    }
  }

  return NextResponse.json({ results, synced, failed });
}
