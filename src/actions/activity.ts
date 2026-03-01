"use server";

/**
 * @file actions/activity.ts
 * @description Server actions for the cross-project activity log viewer and undo system.
 *
 * Activity logs are append-only audit records written by every other action file.
 * This file provides two capabilities:
 *
 *   1. `getActivityLogs` — Paginated, filterable query of all activity logs.
 *      Restricted to ADMIN and PROJECT_MANAGER roles; CONTRACTOR and below cannot
 *      query cross-project activity (they see it inline on their project pages instead).
 *
 *   2. `undoActivity` — Reverses specific reversible actions by re-applying the
 *      stored `oldStatus`/`oldRole` from the log's `data` JSON blob.
 *      ADMIN-only. After reversal, logs a new entry describing the undo and
 *      hard-deletes the original log row.
 *
 * Reversible action types:
 *   - PROJECT_STATUS_CHANGED  — restores project status to `data.oldStatus`
 *   - PHASE_STATUS_CHANGED    — restores phase status to `data.oldStatus`
 *   - MEMBER_REMOVED          — re-creates the ProjectMember row
 *   - MEMBER_UPDATED          — reverts the role to `data.oldRole`
 *   - CHECKLIST_ITEM_TOGGLED  — re-toggles the checklist item to `data.wasCompleted`
 *
 * Actions NOT listed above (e.g. PROJECT_CREATED, DOCUMENT_UPLOADED) are
 * considered irreversible and will throw "Cannot undo action type: …".
 *
 * Note: The `data` column is stored as JSON in the DB (`Record<string, unknown>`).
 * All field accesses cast through `as string | boolean` — TypeScript cannot
 * narrow untyped JSON, so these casts are intentional.
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── Queries ──

/**
 * Paginated, optionally-filtered query of the activity log.
 * Returns a page of log entries alongside the total count for pagination controls.
 *
 * Access: ADMIN and PROJECT_MANAGER only — these roles see cross-project history.
 * CONTRACTOR / STAKEHOLDER / VIEWER are blocked (Forbidden).
 *
 * @param opts.projectId  - Filter to a single project (optional).
 * @param opts.actionType - Filter to a specific action string, e.g. "PHASE_STATUS_CHANGED" (optional).
 * @param opts.page       - 1-based page number (default 1).
 * @param opts.limit      - Items per page (default 50).
 * @returns `{ logs[], total, pages }` — logs are plain serialisable objects with
 *   ISO string dates (safe to pass to client components).
 */
export async function getActivityLogs(opts?: {
  projectId?: string;
  actionType?: string;
  page?: number;
  limit?: number;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Role check — fetch fresh from DB to guard against stale JWT role claim
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || !["ADMIN", "PROJECT_MANAGER"].includes(user.role)) {
    throw new Error("Forbidden");
  }

  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 50;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (opts?.projectId) where.projectId = opts.projectId;
  if (opts?.actionType) where.action = opts.actionType;

  const [logs, total] = await Promise.all([
    db.activityLog.findMany({
      where: { ...where, orgId: session.user.orgId! },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.activityLog.count({ where }),
  ]);

  return {
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      message: l.message,
      data: l.data as Record<string, unknown> | null,
      projectId: l.projectId,
      projectName: l.project.name,
      userId: l.userId,
      userName: l.user.name ?? l.user.email,
      userImage: l.user.image,
      createdAt: l.createdAt.toISOString(), // Plain string — safe for server→client
    })),
    total,
    pages: Math.ceil(total / limit),
  };
}

// ── Undo System ──

/**
 * Reverse a previously logged action, if the action type is reversible.
 *
 * The undo mechanism reads the `data` JSON blob from the original log entry,
 * extracts the pre-change values (oldStatus, oldRole, etc.), and applies them
 * back to the database.
 *
 * After reversal:
 *   1. A new activity log entry is created with message "Undo: <original message>"
 *      to preserve the audit trail.
 *   2. The original log entry is hard-deleted.
 *
 * Requires: ADMIN role — undo is a privileged operation.
 *
 * @param logId - ID of the ActivityLog entry to reverse.
 * @throws If the log is not found, the action is not reversible, or required
 *         data fields are missing from the log's JSON payload.
 */
export async function undoActivity(logId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "ADMIN") throw new Error("Only admins can undo");

  const log = await db.activityLog.findUnique({ where: { id: logId } });
  if (!log) throw new Error("Activity not found");

  // The `data` column is untyped JSON — cast fields explicitly as they are used
  const data = (log.data ?? {}) as Record<string, unknown>;

  switch (log.action) {
    case "PROJECT_STATUS_CHANGED": {
      const oldStatus = data.oldStatus as string;
      if (!oldStatus) throw new Error("Cannot undo: missing old status");
      await db.project.update({
        where: { id: log.projectId },
        data: { status: oldStatus as never },
      });
      break;
    }

    case "PHASE_STATUS_CHANGED": {
      const phaseId = data.phaseId as string;
      const oldStatus = data.oldStatus as string;
      if (!phaseId || !oldStatus) throw new Error("Cannot undo: missing data");
      await db.phase.update({
        where: { id: phaseId },
        data: { status: oldStatus as never },
      });
      break;
    }

    case "MEMBER_REMOVED": {
      // Re-create the membership row — use stored memberId as ID if available
      // to preserve any references to the original row (rare, but defensive)
      const memberId = data.memberId as string;
      const memberUserId = data.userId as string;
      const memberRole = data.role as string;
      if (!memberUserId || !memberRole) throw new Error("Cannot undo: missing member data");
      await db.projectMember.create({
        data: {
          id: memberId || undefined,
          userId: memberUserId,
          projectId: log.projectId,
          role: memberRole as never,
        },
      });
      break;
    }

    case "MEMBER_UPDATED": {
      // Revert to the role the member had BEFORE the update
      const memberUserId = data.userId as string;
      const oldRole = data.oldRole as string;
      if (!memberUserId || !oldRole) throw new Error("Cannot undo: missing role data");
      await db.projectMember.updateMany({
        where: { userId: memberUserId, projectId: log.projectId },
        data: { role: oldRole as never },
      });
      break;
    }

    case "CHECKLIST_ITEM_TOGGLED": {
      // Re-apply the pre-toggle completion state
      const itemId = data.itemId as string;
      const wasCompleted = data.wasCompleted as boolean;
      if (!itemId) throw new Error("Cannot undo: missing item");
      await db.checklistItem.update({
        where: { id: itemId },
        data: {
          completed: wasCompleted ?? false,
          // Restore original completedById if item was previously completed;
          // clear it if it was previously uncompleted
          completedById: wasCompleted ? (data.completedById as string) : null,
        },
      });
      break;
    }

    default:
      throw new Error(`Cannot undo action type: ${log.action}`);
  }

  // Write an "Undo:" audit entry — preserves the trail even after reversal
  await db.activityLog.create({
    data: {
      orgId: session.user.orgId!,
      action: log.action,
      message: `Undo: ${log.message}`,
      data: { undoneLogId: log.id, ...data },
      projectId: log.projectId,
      userId: session.user.id,
    },
  });

  // Hard-delete the original log row now that the undo is recorded
  await db.activityLog.delete({ where: { id: logId } });

  revalidatePath("/dashboard/activity");
  revalidatePath(`/dashboard/projects/${log.projectId}`);
  revalidatePath("/dashboard");
}
