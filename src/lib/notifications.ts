import { db } from "@/lib/db";

type NotificationType =
  | "PHASE_STATUS_CHANGED"
  | "CHECKLIST_COMPLETED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_STATUS_CHANGED"
  | "PHOTO_UPLOADED"
  | "REVIEW_REQUESTED"
  | "REVIEW_COMPLETED"
  | "TIMELINE_SHIFTED"
  | "MEMBER_INVITED";

interface NotifyOptions {
  type: NotificationType;
  title: string;
  message: string;
  recipientIds: string[];
  actorId?: string; // The user who triggered the action (excluded from recipients)
  data?: Record<string, unknown>; // projectId, phaseId, documentId, etc.
}

/**
 * Create in-app notifications for multiple users.
 * Fire-and-forget: logs errors but never throws.
 *
 * Usage:
 *   await notify({
 *     type: "PHASE_STATUS_CHANGED",
 *     title: "Phase Started",
 *     message: "Foundation phase is now in progress",
 *     recipientIds: memberUserIds,
 *     actorId: session.user.id,
 *     data: { projectId, phaseId },
 *   });
 */
export async function notify(options: NotifyOptions): Promise<void> {
  try {
    const { type, title, message, recipientIds, actorId, data } = options;

    // Filter out the actor (don't notify yourself) and remove duplicates
    const uniqueRecipients = [...new Set(recipientIds)].filter(
      (id) => id !== actorId
    );

    if (uniqueRecipients.length === 0) return;

    await db.notification.createMany({
      data: uniqueRecipients.map((userId) => ({
        type,
        title,
        message,
        userId,
        data: data ?? undefined,
      })),
    });

    // TODO: Future — send email/push notifications based on user preferences
    // if (sendEmail) { await sendNotificationEmails(uniqueRecipients, options); }
  } catch (error) {
    console.error("[notify] Failed to create notifications:", error);
    // Non-critical: don't throw so the main action still succeeds
  }
}

/**
 * Get all project member user IDs for a given project.
 * Useful for notifying everyone on a project.
 */
export async function getProjectMemberIds(
  projectId: string
): Promise<string[]> {
  const members = await db.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}
