"use server";

/**
 * @file actions/notification-preferences.ts
 * @description Server actions for managing user notification preferences and phone numbers.
 *
 * Notification preferences control which channels (email, SMS, in-app) and
 * which event categories trigger notifications for the current user.
 * They are stored in the `NotificationPreference` table (one row per user,
 * in the generated Prisma types).
 *
 * Design decisions:
 *   - `getNotificationPreferences` returns the `DEFAULTS` constant (not null)
 *     when no row exists, so UI consumers never need to handle a missing record.
 *   - `updateNotificationPreferences` uses `upsert` so first-save users don't
 *     need a separate "initialise" call; the DEFAULTS are spread as the `create`
 *     base and the caller's partial update is applied on top.
 *   - Phone numbers are stored on the `User` table (not on preferences) because
 *     they are a first-class profile field and must pass E.164 validation.
 *   - Both settings paths (dashboard and contractor portal) are revalidated
 *     because preferences are accessible from either route.
 *
 * All functions require an authenticated session.
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── Types ──

/** The full set of notification preference fields. */
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

/**
 * Default notification preferences applied when a user has no saved row.
 * Also used as the `create` base in `updateNotificationPreferences` upsert
 * so that a first-time save inherits sensible defaults for untouched fields.
 *
 * SMS is off by default (requires phone number setup); in-app and core
 * email events are on. Email comments are off to reduce noise for most users.
 */
const DEFAULTS: NotificationPreferences = {
  emailEnabled: true,
  smsEnabled: false,       // Off until user adds a phone number
  inAppEnabled: true,
  emailPhaseStatus: true,
  emailReview: true,
  emailChecklist: true,
  emailDocuments: true,
  emailComments: false,    // Off by default — high-volume channel
  smsPhaseStatus: true,
  smsReview: true,
  smsChecklist: false,
  smsDocuments: false,
  quietStart: null,        // null = no quiet hours configured
  quietEnd: null,
};

// ── Queries ──

/**
 * Fetch the current user's notification preferences.
 *
 * Returns the `DEFAULTS` constant directly when no row exists so that UI
 * consumers always receive a fully-populated preferences object without
 * needing to handle `null` or merge with defaults themselves.
 *
 * The explicit field mapping (rather than returning `prefs` directly) strips
 * internal Prisma fields (id, userId, updatedAt) from the response, keeping
 * the return type clean and stable.
 *
 * @throws "Unauthorized" if no session.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const prefs = await db.notificationPreference.findUnique({
    where: { userId: session.user.id },
  });

  // No row yet — return defaults without creating the row (lazy initialisation).
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

// ── Mutations ──

/**
 * Update the current user's notification preferences (partial update).
 *
 * Uses `upsert` so new users get the DEFAULTS as a base on first save.
 * Only the fields present in `data` are updated on subsequent calls.
 *
 * Revalidates both the dashboard and contractor portal settings paths
 * since preferences are accessible from either route.
 *
 * @param data - Partial preferences object; only provided fields are changed.
 * @throws "Unauthorized" if no session.
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
      ...DEFAULTS, // Spread defaults first so untouched fields have sensible values
      ...data,     // Caller's values override defaults
    },
    update: data,  // Subsequent saves only touch the specified fields
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/contractor/settings");
  return { success: true };
}

/**
 * Update the current user's phone number for SMS notification delivery.
 *
 * Phone numbers are stored on the `User` table (not on preferences) because
 * they are a profile field used in other contexts beyond notifications.
 *
 * Validates E.164 format (+[country code][number], up to 15 digits total).
 * An empty string clears the phone number (sets it to null).
 *
 * @param phone - E.164 phone number string, or empty string to clear.
 * @throws "Unauthorized" if no session.
 * @throws Validation error for malformed phone numbers.
 */
export async function updatePhoneNumber(phone: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // E.164: leading +, country code (1 digit, non-zero), up to 14 more digits.
  if (phone && !phone.match(/^\+[1-9]\d{1,14}$/)) {
    throw new Error("Invalid phone number format. Use E.164 format: +1234567890");
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { phone: phone || null }, // Empty string → null
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/contractor/settings");
  return { success: true };
}

/**
 * Retrieve the current user's phone number.
 * Returns null (not throws) for unauthenticated callers so it's safe to
 * call from server components without guarding the session.
 *
 * @returns The E.164 phone number string, or null if not set / not authed.
 */
export async function getUserPhone(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true }, // Minimal projection — only the phone field needed
  });

  return user?.phone || null;
}
