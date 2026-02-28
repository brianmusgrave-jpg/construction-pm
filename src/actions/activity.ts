"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getActivityLogs(opts?: {
  projectId?: string;
  actionType?: string;
  page?: number;
  limit?: number;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Only ADMIN / PM can see cross-project logs
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
      where,
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
      createdAt: l.createdAt.toISOString(),
    })),
    total,
    pages: Math.ceil(total / limit),
  };
}

export async function undoActivity(logId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "ADMIN") throw new Error("Only admins can undo");

  const log = await db.activityLog.findUnique({ where: { id: logId } });
  if (!log) throw new Error("Activity not found");

  const data = (log.data ?? {}) as Record<string, unknown>;

  // Handle reversible actions
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
      const memberId = data.memberId as string;
      const memberUserId = data.userId as string;
      const memberRole = data.role as string;
      if (!memberUserId || !memberRole) throw new Error("Cannot undo: missing member data");
      // Re-add the member
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
      const itemId = data.itemId as string;
      const wasCompleted = data.wasCompleted as boolean;
      if (!itemId) throw new Error("Cannot undo: missing item");
      await db.checklistItem.update({
        where: { id: itemId },
        data: {
          completed: wasCompleted ?? false,
          completedById: wasCompleted ? (data.completedById as string) : null,
        },
      });
      break;
    }

    default:
      throw new Error(`Cannot undo action type: ${log.action}`);
  }

  // Log the undo itself
  await db.activityLog.create({
    data: {
      action: log.action,
      message: `Undo: ${log.message}`,
      data: { undoneLogId: log.id, ...data },
      projectId: log.projectId,
      userId: session.user.id,
    },
  });

  // Delete the original log entry
  await db.activityLog.delete({ where: { id: logId } });

  revalidatePath("/dashboard/activity");
  revalidatePath(`/dashboard/projects/${log.projectId}`);
  revalidatePath("/dashboard");
}
