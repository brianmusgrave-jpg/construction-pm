"use server";

/**
 * @file actions/phases.ts
 * @description Server actions for phase lifecycle management within a project.
 *
 * Phases are the core scheduling unit — each maps to a row on the Gantt chart
 * and has its own status workflow, staff assignments, documents, photos, and
 * inspection/change-order history.
 *
 * Status workflow (forward-only in typical use):
 *   PENDING → IN_PROGRESS → REVIEW_REQUESTED → UNDER_REVIEW → COMPLETE
 *
 * Key behaviors:
 * - createPhase: Auto-assigns sortOrder as (max + 1) to append at end of Gantt.
 * - updatePhaseDates: No cache revalidation — caller must debounce during Gantt drag.
 * - updatePhaseStatus: Records actualStart/actualEnd automatically; fires SSE notifications.
 * - assignStaffToPhase: Enforces single-owner constraint (demotes previous owner).
 * - getProjectPhases: Returns phases ordered by sortOrder for Gantt rendering.
 *
 * All mutations require authentication. Phase creation/deletion requires
 * canManagePhase (ADMIN or PROJECT_MANAGER). Status transitions to UNDER_REVIEW
 * or COMPLETE are additionally restricted to ADMIN/PROJECT_MANAGER.
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { canManagePhase } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notify, getProjectMemberIds } from "@/lib/notifications";

// ── Zod Schemas ──

/** Validates phase creation input — both wizard-created and inline-created phases. */
const CreatePhaseSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(200),
  detail: z.string().max(1000).optional(),
  isMilestone: z.boolean().optional(),
  estStart: z.string(),
  estEnd: z.string(),
  worstStart: z.string().optional(), // Pessimistic scenario start date
  worstEnd: z.string().optional(),   // Pessimistic scenario end date
  sortOrder: z.number().int().optional(), // If omitted, appended at end
});

/** Validates Gantt drag-resize date updates for a single phase. */
const UpdateDatesSchema = z.object({
  phaseId: z.string().min(1),
  estStart: z.string(),
  estEnd: z.string(),
  worstStart: z.string().optional().nullable(),
  worstEnd: z.string().optional().nullable(),
});

// ── Mutations ──

/**
 * Add a new phase to a project, appended after the last existing phase.
 * If sortOrder is provided explicitly (e.g. from wizard), it is used as-is;
 * otherwise auto-computed as max(sortOrder) + 1.
 * Fires a fire-and-forget activity log (errors silently suppressed).
 *
 * Requires: ADMIN or PROJECT_MANAGER role.
 */
export async function createPhase(data: z.infer<typeof CreatePhaseSchema>) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManagePhase(session.user.role)) throw new Error("Forbidden");

  const parsed = CreatePhaseSchema.parse(data);

  // Determine sort position — appends after the last phase if not specified
  const maxOrder = await db.phase.aggregate({
    where: { projectId: parsed.projectId },
    _max: { sortOrder: true },
  });

  const phase = await db.phase.create({
    data: {
      projectId: parsed.projectId,
      name: parsed.name,
      detail: parsed.detail,
      isMilestone: parsed.isMilestone || false,
      estStart: new Date(parsed.estStart),
      estEnd: new Date(parsed.estEnd),
      worstStart: parsed.worstStart ? new Date(parsed.worstStart) : null,
      worstEnd: parsed.worstEnd ? new Date(parsed.worstEnd) : null,
      sortOrder: parsed.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  // Fire-and-forget activity log — don't block the response on logging
  db.activityLog.create({
    data: {
      action: "PHASE_CREATED",
      message: `Added phase "${parsed.name}"`,
      projectId: parsed.projectId,
      userId: session.user.id,
      data: { phaseId: phase.id },
    },
  }).catch(() => {});

  revalidatePath(`/dashboard/projects/${parsed.projectId}`);
  return phase;
}

/**
 * Update the estimated (and optionally pessimistic) date range for a phase.
 * Typically called from the Gantt drag/resize handler — callers are responsible
 * for debouncing to avoid thrashing the DB on every pixel of drag movement.
 * Intentionally does NOT call revalidatePath so the Gantt stays responsive.
 *
 * Requires: authenticated session (no role check).
 */
export async function updatePhaseDates(
  data: z.infer<typeof UpdateDatesSchema>
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = UpdateDatesSchema.parse(data);

  await db.phase.update({
    where: { id: parsed.phaseId },
    data: {
      estStart: new Date(parsed.estStart),
      estEnd: new Date(parsed.estEnd),
      worstStart: parsed.worstStart ? new Date(parsed.worstStart) : undefined,
      worstEnd: parsed.worstEnd ? new Date(parsed.worstEnd) : undefined,
    },
  });

  // Don't revalidate on every drag — caller should debounce
}

/**
 * Advance or revert a phase's status within the status workflow.
 * Side effects:
 *   - Sets actualStart to now when transitioning to IN_PROGRESS.
 *   - Sets actualEnd to now and forces progress=100 on COMPLETE.
 *   - Fires SSE notifications to all project members (fire-and-forget).
 *   - Logs a PHASE_STATUS_CHANGED activity entry.
 *
 * Role restriction: only ADMIN/PROJECT_MANAGER can set UNDER_REVIEW or COMPLETE.
 *
 * Requires: authenticated session.
 */
export async function updatePhaseStatus(
  phaseId: string,
  status: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const validStatuses = [
    "PENDING",
    "IN_PROGRESS",
    "REVIEW_REQUESTED",
    "UNDER_REVIEW",
    "COMPLETE",
  ];
  if (!validStatuses.includes(status)) throw new Error("Invalid status");

  // Only PM/Admin can approve reviews or mark complete
  if (
    (status === "UNDER_REVIEW" || status === "COMPLETE") &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "PROJECT_MANAGER"
  ) {
    throw new Error("Forbidden");
  }

  const phase = await db.phase.update({
    where: { id: phaseId },
    data: {
      status: status as "PENDING" | "IN_PROGRESS" | "REVIEW_REQUESTED" | "UNDER_REVIEW" | "COMPLETE",
      // Auto-set timestamps at status boundaries
      ...(status === "COMPLETE" ? { progress: 100, actualEnd: new Date() } : {}),
      ...(status === "IN_PROGRESS" && { actualStart: new Date() }),
    },
    include: { project: true },
  });

  // Human-readable labels for notification copy
  const statusLabels: Record<string, string> = {
    IN_PROGRESS: "started",
    REVIEW_REQUESTED: "ready for review",
    UNDER_REVIEW: "under review",
    COMPLETE: "completed",
    PENDING: "set to pending",
  };

  // Notify all project members; use REVIEW_REQUESTED type for that specific transition
  const memberIds = await getProjectMemberIds(phase.projectId);
  const notifType = status === "REVIEW_REQUESTED" ? "REVIEW_REQUESTED" as const : "PHASE_STATUS_CHANGED" as const;
  notify({
    type: notifType,
    title: status === "REVIEW_REQUESTED"
      ? `Review Requested: ${phase.name}`
      : `Phase ${statusLabels[status] || "updated"}: ${phase.name}`,
    message: `${phase.name} on ${phase.project.name} is now ${statusLabels[status] || status.toLowerCase()}`,
    recipientIds: memberIds,
    actorId: session.user.id,
    data: { projectId: phase.projectId, phaseId: phase.id, newStatus: status },
  });

  // Fire-and-forget activity log
  db.activityLog.create({
    data: {
      action: "PHASE_STATUS_CHANGED",
      message: `${phase.name} ${statusLabels[status] || "updated"}`,
      projectId: phase.projectId,
      userId: session.user.id,
      data: { phaseId: phase.id, newStatus: status },
    },
  }).catch(() => {}); // fire-and-forget

  revalidatePath(`/dashboard/projects/${phase.projectId}`);
  return phase;
}

/**
 * Permanently delete a phase and all cascaded data (assignments, documents, etc.).
 * Irreversible — prefer status changes for soft workflows.
 *
 * Requires: ADMIN or PROJECT_MANAGER role.
 */
export async function deletePhase(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManagePhase(session.user.role)) throw new Error("Forbidden");

  const phase = await db.phase.delete({ where: { id: phaseId } });
  revalidatePath(`/dashboard/projects/${phase.projectId}`);
}

/**
 * Assign a staff member to a phase, optionally designating them as the phase owner.
 * Only one owner is allowed per phase — if isOwner=true, any existing owner is
 * demoted to a regular assignee before the new assignment is created.
 *
 * Requires: ADMIN or PROJECT_MANAGER role.
 */
export async function assignStaffToPhase(
  phaseId: string,
  staffId: string,
  isOwner: boolean = false
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManagePhase(session.user.role)) throw new Error("Forbidden");

  // Enforce single-owner constraint — demote existing owner before promoting new one
  if (isOwner) {
    await db.phaseAssignment.updateMany({
      where: { phaseId, isOwner: true },
      data: { isOwner: false },
    });
  }

  const assignment = await db.phaseAssignment.create({
    data: { phaseId, staffId, isOwner },
    include: {
      staff: { select: { name: true } },
      phase: { select: { name: true, projectId: true } },
    },
  });

  // Fire-and-forget activity log
  db.activityLog.create({
    data: {
      action: "STAFF_ASSIGNED",
      message: `Assigned ${assignment.staff.name} to ${assignment.phase.name}${isOwner ? " as owner" : ""}`,
      projectId: assignment.phase.projectId,
      userId: session.user.id,
      data: { phaseId, staffId },
    },
  }).catch(() => {});

  revalidatePath(`/dashboard/projects/${assignment.phase.projectId}`);

  return assignment;
}

/**
 * Remove a staff assignment from a phase by assignment ID.
 * Logs the removal as a STAFF_UNASSIGNED activity entry.
 *
 * Requires: ADMIN or PROJECT_MANAGER role.
 */
export async function unassignStaffFromPhase(assignmentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManagePhase(session.user.role)) throw new Error("Forbidden");

  const assignment = await db.phaseAssignment.delete({
    where: { id: assignmentId },
    include: {
      staff: { select: { name: true } },
      phase: { select: { name: true, projectId: true } },
    },
  });

  // Fire-and-forget activity log
  db.activityLog.create({
    data: {
      action: "STAFF_UNASSIGNED",
      message: `Removed ${assignment.staff.name} from ${assignment.phase.name}`,
      projectId: assignment.phase.projectId,
      userId: session.user.id,
    },
  }).catch(() => {});

  revalidatePath(`/dashboard/projects/${assignment.phase.projectId}`);
}

// ── Queries ──

/**
 * Fetch all phases for a project in Gantt display order (sortOrder asc).
 * Includes staff assignments (with name/company for the assignment pill) and
 * document/photo counts (for the phase detail sidebar badges).
 *
 * No auth check — phase visibility is gated at the project membership level
 * by the page/layout that calls this.
 */
export async function getProjectPhases(projectId: string) {
  return db.phase.findMany({
    where: { projectId },
    include: {
      assignments: {
        include: {
          staff: { select: { id: true, name: true, company: true } },
        },
      },
      _count: { select: { documents: true, photos: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
}
