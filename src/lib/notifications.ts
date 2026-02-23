import { db } from "@/lib/db";
import {
  sendPhaseStatusEmail,
  sendReviewRequestEmail,
  sendChecklistCompleteEmail,
  sendDocumentStatusEmail,
} from "@/lib/email";
import {
  sendPhaseStatusSMS,
  sendReviewRequestSMS,
  sendChecklistCompleteSMS,
  sendDocumentStatusSMS,
} from "@/lib/sms";

type NotificationType =
  | "PHASE_STATUS_CHANGED"
  | "CHECKLIST_COMPLETED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_STATUS_CHANGED"
  | "PHOTO_UPLOADED"
  | "REVIEW_REQUESTED"
  | "REVIEW_COMPLETED"
  | "TIMELINE_SHIFTED"
  | "MEMBER_INVITED"
  | "COMMENT_ADDED"
  | "DEPENDENCY_CHANGED"
  | "CHANGE_ORDER_SUBMITTED"
  | "CHANGE_ORDER_APPROVED"
  | "CHANGE_ORDER_REJECTED"
  | "INSPECTION_SCHEDULED"
  | "INSPECTION_RESULT";

interface NotifyOptions {
  type: NotificationType;
  title: string;
  message: string;
  recipientIds: string[];
  actorId?: string; // The user who triggered the action (excluded from recipients)
  data?: Record<string, unknown>; // projectId, phaseId, documentId, etc.
}

interface UserPref {
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  emailPhaseStatus: boolean;
  emailReview: boolean;
  emailChecklist: boolean;
  emailDocuments: boolean;
  emailComments: boolean;
  smsPhaseStatus: boolean;
  smsReview: boolean;
  smsChecklist: boolean;
  smsDocuments: boolean;
  quietStart: string | null;
  quietEnd: string | null;
}

/**
 * Create in-app notifications + send email/SMS based on user preferences.
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

    // Fetch user preferences for all recipients
    const prefs = await db.notificationPreference.findMany({
      where: { userId: { in: uniqueRecipients } },
    });
    const prefsMap = new Map<string, UserPref>(
      prefs.map((p: UserPref) => [p.userId, p] as [string, UserPref])
    );

    // 1. Create in-app notifications (respect inAppEnabled)
    const inAppRecipients = uniqueRecipients.filter((id) => {
      const pref = prefsMap.get(id);
      return !pref || pref.inAppEnabled; // Default: enabled
    });

    if (inAppRecipients.length > 0) {
      await db.notification.createMany({
        data: inAppRecipients.map((userId) => ({
          type,
          title,
          message,
          userId,
          data: (data ?? undefined) as any,
        })),
      });
    }

    // 2. Send email notifications (fire-and-forget, respect preferences)
    sendEmailNotifications(type, uniqueRecipients, prefsMap, data).catch((err) =>
      console.error("[notify] Email send failed:", err)
    );

    // 3. Send SMS notifications (fire-and-forget, respect preferences)
    sendSMSNotifications(type, uniqueRecipients, prefsMap, data).catch((err) =>
      console.error("[notify] SMS send failed:", err)
    );
  } catch (error) {
    console.error("[notify] Failed to create notifications:", error);
  }
}

// ── Preference Helpers ──

function isInQuietHours(pref: { quietStart: string | null; quietEnd: string | null }): boolean {
  if (!pref.quietStart || !pref.quietEnd) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = pref.quietStart.split(":").map(Number);
  const [endH, endM] = pref.quietEnd.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range (e.g., 22:00 - 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

function shouldSendEmail(type: NotificationType, pref: UserPref): boolean {
  if (!pref.emailEnabled || isInQuietHours(pref)) return false;

  switch (type) {
    case "PHASE_STATUS_CHANGED": return pref.emailPhaseStatus;
    case "REVIEW_REQUESTED":
    case "REVIEW_COMPLETED": return pref.emailReview;
    case "CHECKLIST_COMPLETED": return pref.emailChecklist;
    case "DOCUMENT_UPLOADED":
    case "DOCUMENT_STATUS_CHANGED": return pref.emailDocuments;
    case "COMMENT_ADDED": return pref.emailComments;
    default: return true;
  }
}

function shouldSendSMS(type: NotificationType, pref: UserPref): boolean {
  if (!pref.smsEnabled || isInQuietHours(pref)) return false;

  switch (type) {
    case "PHASE_STATUS_CHANGED": return pref.smsPhaseStatus;
    case "REVIEW_REQUESTED":
    case "REVIEW_COMPLETED": return pref.smsReview;
    case "CHECKLIST_COMPLETED": return pref.smsChecklist;
    case "DOCUMENT_UPLOADED":
    case "DOCUMENT_STATUS_CHANGED": return pref.smsDocuments;
    default: return false;
  }
}

// ── Project/Phase Name Resolver ──

async function resolveNames(data?: Record<string, unknown>) {
  const projectId = (data?.projectId as string) || "";
  const phaseId = (data?.phaseId as string) || "";

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

  return { projectId, phaseId, projectName, phaseName };
}

// ── Email Notifications ──

async function sendEmailNotifications(
  type: NotificationType,
  recipientIds: string[],
  prefsMap: Map<string, UserPref>,
  data?: Record<string, unknown>
): Promise<void> {
  const emailRecipients = recipientIds.filter((id) => {
    const pref = prefsMap.get(id);
    if (!pref) return true; // Default: send emails
    return shouldSendEmail(type, pref);
  });

  if (emailRecipients.length === 0) return;

  const users = await db.user.findMany({
    where: { id: { in: emailRecipients } },
    select: { email: true },
  });

  const emails = users.map((u: typeof users[number]) => u.email).filter(Boolean);
  if (emails.length === 0) return;

  const { projectId, phaseId, projectName, phaseName } = await resolveNames(data);

  for (const email of emails) {
    switch (type) {
      case "PHASE_STATUS_CHANGED":
        await sendPhaseStatusEmail(email, projectName, phaseName || "a phase", (data?.newStatus as string) || "updated", projectId);
        break;
      case "REVIEW_REQUESTED":
        await sendReviewRequestEmail(email, projectName, phaseName || "a phase", projectId, phaseId);
        break;
      case "CHECKLIST_COMPLETED":
        await sendChecklistCompleteEmail(email, projectName, phaseName || "a phase", projectId, phaseId);
        break;
      case "DOCUMENT_STATUS_CHANGED":
        await sendDocumentStatusEmail(email, projectName, (data?.documentName as string) || "a document", (data?.newStatus as string) || "updated", projectId);
        break;
      default:
        break;
    }
  }
}

// ── SMS Notifications ──

async function sendSMSNotifications(
  type: NotificationType,
  recipientIds: string[],
  prefsMap: Map<string, UserPref>,
  data?: Record<string, unknown>
): Promise<void> {
  const smsRecipients = recipientIds.filter((id) => {
    const pref = prefsMap.get(id);
    return pref && shouldSendSMS(type, pref);
  });

  if (smsRecipients.length === 0) return;

  const users = await db.user.findMany({
    where: { id: { in: smsRecipients }, phone: { not: null } },
    select: { phone: true },
  });

  const phones = users
    .map((u: typeof users[number]) => u.phone)
    .filter((p: string | null): p is string => !!p);
  if (phones.length === 0) return;

  const { projectName, phaseName } = await resolveNames(data);

  for (const phone of phones) {
    switch (type) {
      case "PHASE_STATUS_CHANGED":
        await sendPhaseStatusSMS(phone, projectName, phaseName || "a phase", (data?.newStatus as string) || "updated");
        break;
      case "REVIEW_REQUESTED":
        await sendReviewRequestSMS(phone, projectName, phaseName || "a phase");
        break;
      case "CHECKLIST_COMPLETED":
        await sendChecklistCompleteSMS(phone, projectName, phaseName || "a phase");
        break;
      case "DOCUMENT_STATUS_CHANGED":
        await sendDocumentStatusSMS(phone, projectName, (data?.documentName as string) || "a document", (data?.newStatus as string) || "updated");
        break;
      default:
        break;
    }
  }
}

/**
 * Get all project member user IDs for a given project.
 */
export async function getProjectMemberIds(
  projectId: string
): Promise<string[]> {
  const members = await db.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  });
  return members.map((m: typeof members[number]) => m.userId);
}
