"use server";

/**
 * @file actions/inspections.ts
 * @description Server actions for scheduling and recording field inspections.
 *
 * Inspections are scheduled against a phase and follow a two-step lifecycle:
 *   1. Scheduled: created with a future `scheduledAt` date, result is null.
 *   2. Completed: result recorded as PASS | FAIL | CONDITIONAL,
 *      `completedAt` set to now, optional notes attached.
 *
 * Notification behavior:
 *   - On schedule: all project members notified via SSE (INSPECTION_SCHEDULED).
 *   - On result: members notified only if `notifyOnResult` is true on the record
 *     (set at creation time, defaults to true).
 *
 * All mutations require an authenticated session. No additional role checks —
 * any project member can schedule and record inspections.
 */

import { db } from "@/lib/db-types";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { notify, getProjectMemberIds } from "@/lib/notifications";
import { z } from "zod";

// ── Zod Schemas ──

/** Validates inspection creation input. */
const CreateInspectionSchema = z.object({
  phaseId: z.string().min(1),
  title: z.string().min(1).max(500),
  inspectorName: z.string().max(200).optional(), // Optional — inspector may not be known yet
  scheduledAt: z.string().min(1),                // ISO date string
  notifyOnResult: z.boolean().optional(),        // Defaults to true in DB
});

/** Valid inspection result values. */
const InspectionResultSchema = z.enum(["PASS", "FAIL", "CONDITIONAL"]);

// ── Queries ──

/**
 * Fetch all inspections for a phase, newest first.
 *
 * Requires: authenticated session.
 */
export async function getInspections(phaseId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return db.inspection.findMany({
    where: { phaseId },
    orderBy: { scheduledAt: "desc" },
  });
}

// ── Mutations ──

/**
 * Schedule a new inspection on a phase.
 * Notifies all project members of the scheduled date via SSE.
 *
 * Requires: authenticated session.
 */
export async function createInspection(data: {
  phaseId: string;
  title: string;
  inspectorName?: string;
  scheduledAt: string;  // ISO date string
  notifyOnResult?: boolean;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const validated = CreateInspectionSchema.parse(data);

  const phase = await db.phase.findUnique({
    where: { id: validated.phaseId },
    select: { id: true, name: true, projectId: true },
  });
  if (!phase) throw new Error("Phase not found");

  const inspection = await db.inspection.create({
    data: {
      title: validated.title,
      inspectorName: validated.inspectorName ?? null,
      scheduledAt: new Date(validated.scheduledAt),
      notifyOnResult: validated.notifyOnResult ?? true,
      phaseId: validated.phaseId,
    },
  });

  // Notify all project members of the scheduled inspection
  const memberIds = await getProjectMemberIds(phase.projectId);
  notify({
    type: "INSPECTION_SCHEDULED",
    title: `Inspection Scheduled: ${validated.title}`,
    message: `Inspection scheduled for ${phase.name} on ${new Date(validated.scheduledAt).toLocaleDateString()}`,
    recipientIds: memberIds,
    actorId: session.user.id,
    data: { projectId: phase.projectId, phaseId: phase.id, inspectionId: inspection.id },
  });

  revalidatePath(`/dashboard/projects/${phase.projectId}`);
  return inspection;
}

/**
 * Record the outcome of a completed inspection.
 * Sets `completedAt` to now and saves the result (PASS/FAIL/CONDITIONAL) and notes.
 * If `notifyOnResult` was set on the inspection record, fires an SSE notification
 * to all project members with a human-readable result label.
 *
 * Requires: authenticated session.
 */
export async function recordInspectionResult(
  inspectionId: string,
  result: "PASS" | "FAIL" | "CONDITIONAL",
  notes?: string
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  InspectionResultSchema.parse(result); // Validate enum before DB write

  const inspection = await db.inspection.findUnique({
    where: { id: inspectionId },
    include: { phase: { select: { projectId: true, name: true } } },
  });
  if (!inspection) throw new Error("Inspection not found");

  const updated = await db.inspection.update({
    where: { id: inspectionId },
    data: { result, completedAt: new Date(), notes: notes ?? null },
  });

  // Only notify if the inspection was created with notifyOnResult=true
  if (inspection.notifyOnResult) {
    const memberIds = await getProjectMemberIds(inspection.phase.projectId);
    const resultLabel = result === "PASS" ? "Passed ✓" : result === "FAIL" ? "Failed ✗" : "Conditional";
    notify({
      type: "INSPECTION_RESULT",
      title: `Inspection ${resultLabel}: ${inspection.title}`,
      message: `${inspection.title} in ${inspection.phase.name}: ${resultLabel}`,
      recipientIds: memberIds,
      actorId: session.user.id,
      data: { projectId: inspection.phase.projectId, phaseId: inspection.phaseId, inspectionId },
    });
  }

  revalidatePath(`/dashboard/projects/${inspection.phase.projectId}`);
  return updated;
}

/**
 * Delete an inspection record (typically to cancel a scheduled inspection).
 *
 * Requires: authenticated session.
 */
export async function deleteInspection(inspectionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const inspection = await db.inspection.findUnique({
    where: { id: inspectionId },
    include: { phase: { select: { projectId: true } } },
  });
  if (!inspection) throw new Error("Inspection not found");

  await db.inspection.delete({ where: { id: inspectionId } });
  revalidatePath(`/dashboard/projects/${inspection.phase.projectId}`);
  return { success: true };
}
