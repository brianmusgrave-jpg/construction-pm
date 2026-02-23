"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

interface NotificationPreferences {
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

const DEFAULTS: NotificationPreferences = {
  emailEnabled: true,
  smsEnabled: false,
  inAppEnabled: true,
  emailPhaseStatus: true,
  emailReview: true,
  emailChecklist: true,
  emailDocuments: true,
  emailComments: false,
  smsPhaseStatus: true,
  smsReview: true,
  smsChecklist: false,
  smsDocuments: false,
  quietStart: null,
  quietEnd: null,
};

/**
 * Get current user's notification preferences (creates defaults if none exist).
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const prefs = await db.notificationPreference.findUnique({
    where: { userId: session.user.id },
  });

  if (!prefs) return DEFAULTS;

  return {
    emailEnabled: prefs.emailEnabled,
    smsEnabled: prefs.smsEnabled,
    inAppEnabled: prefs.inAppEnabled,
    emailPhaseStatus: prefs.emailPhaseStatus,
    emailReview: prefs.emailReview,
    emailChecklist: prefs.emailChecklist,
    emailDocuments: prefs.emailDocuments,
    emailComments: prefs.emailComments,
    smsPhaseStatus: prefs.smsPhaseStatus,
    smsReview: prefs.smsReview,
    smsChecklist: prefs.smsChecklist,
    smsDocuments: prefs.smsDocuments,
    quietStart: prefs.quietStart,
    quietEnd: prefs.quietEnd,
  };
}

/**
 * Update current user's notification preferences.
 */
export async function updateNotificationPreferences(
  data: Partial<NotificationPreferences>
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db.notificationPreference.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      ...DEFAULTS,
      ...data,
    },
    update: data,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/contractor/settings");
  return { success: true };
}

/**
 * Update current user's phone number (for SMS notifications).
 */
export async function updatePhoneNumber(phone: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Basic E.164 validation
  if (phone && !phone.match(/^\+[1-9]\d{1,14}$/)) {
    throw new Error("Invalid phone number format. Use E.164 format: +1234567890");
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { phone: phone || null },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/contractor/settings");
  return { success: true };
}

/**
 * Get current user's phone number.
 */
export async function getUserPhone(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  });

  return user?.phone || null;
}
