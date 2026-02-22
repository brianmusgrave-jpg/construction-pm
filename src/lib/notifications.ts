import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  sendPhaseStatusEmail,
  sendReviewRequestEmail,
  sendChecklistCompleteEmail,
  sendDocumentStatusEmail,
} from "@/lib/email";

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
 * Create in-app notifications for multiple users + send email notifications.
 * Fire-and-forget: logs errors but never throws.
 */
export async function notify(options: NotifyOptions): Promise<void> {
  try {
    const { type, title, message, recipientIds, actorId, data } = options;

    // Filter out the actor (don't notify yourself) and remove duplicates
    const uniqueRecipients = [...new Set(recipientIds)].filter(
      (id) => id !== actorId
    );

    if (uniqueRecipients.length === 0) return;

    // 1. Create in-app notifications
    await db.notification.createMany({
      data: uniqueRecipients.map((userId) => ({
        type,
        title,
        message,
        userId,
        data: (data as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      })),
    });

    // 2. Send email notifications (fire-and-forget)
    sendEmailNotifications(type, uniqueRecipients, data).catch((err) =>
      console.error("[notify] Email send failed:", err)
    );
  } catch (error) {
    console.error("[notify] Failed to create notifications:", error);
  }
}

/**
 * Send email notifications based on notification type.
 * Fetches recipient emails from DB and sends appropriate template.
 */
async function sendEmailNotifications(
  type: NotificationType,
  recipientIds: string[],
  data?: Record<string, unknown>
): Promise<void> {
  // Fetch recipient emails
  const users = await db.user.findMany({
    where: { id: { in: recipientIds } },
    select: { email: true },
  });

  const emails = users.map((u) => u.email).filter(Boolean);
  if (emails.length === 0) return;

  const projectId = (data?.projectId as string) || "";
  const phaseId = (data?.phaseId as string) || "";

  // Fetch project name if we have a projectId
  let projectName = "your project";
  let phaseName = "";
  if (projectId) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    if (project) projectName = project.name;
  }
  if (phaseId) {
    const phase = await db.phase.findUnique({
      where: { id: phaseId },
      select: { name: true },
    });
    if (phase) phaseName = phase.name;
  }

  for (const email of emails) {
    switch (type) {
      case "PHASE_STATUS_CHANGED":
        await sendPhaseStatusEmail(
          email,
          projectName,
          phaseName || "a phase",
          (data?.newStatus as string) || "updated",
          projectId
        );
        break;

      case "REVIEW_REQUESTED":
        await sendReviewRequestEmail(
          email,
          projectName,
          phaseName || "a phase",
          projectId,
          phaseId
        );
        break;

      case "CHECKLIST_COMPLETED":
        await sendChecklistCompleteEmail(
          email,
          projectName,
          phaseName || "a phase",
          projectId,
          phaseId
        );
        break;

      case "DOCUMENT_STATUS_CHANGED":
        await sendDocumentStatusEmail(
          email,
          projectName,
          (data?.documentName as string) || "a document",
          (data?.newStatus as string) || "updated",
          projectId
        );
        break;

      // Other types: in-app only for now (no email)
      default:
        break;
    }
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
