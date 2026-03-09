/**
 * @file src/actions/tos.ts
 * @description Server actions for Terms of Service acceptance and re-affirmation.
 * Tracks which TOS version each user accepted and when.
 * Re-affirmation is triggered by role changes, org plan changes, or TOS version bumps.
 */
"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const dbc = db as any;

/** Current TOS version — bump this whenever TOS content changes. */
export const CURRENT_TOS_VERSION = "1.0";

/**
 * Check if the current user needs to accept (or re-accept) the TOS.
 * Returns true if the user has not accepted, or accepted an older version.
 */
export async function checkTosStatus(): Promise<{
  needsAcceptance: boolean;
  currentVersion: string;
  acceptedVersion: string | null;
  acceptedAt: string | null;
}> {
  const session = await auth();
  if (!session?.user) {
    return {
      needsAcceptance: true,
      currentVersion: CURRENT_TOS_VERSION,
      acceptedVersion: null,
      acceptedAt: null,
    };
  }

  const user = await dbc.user.findUnique({
    where: { id: session.user.id },
    select: { tosAcceptedAt: true, tosVersion: true },
  });

  const needsAcceptance = !user?.tosAcceptedAt || user?.tosVersion !== CURRENT_TOS_VERSION;

  return {
    needsAcceptance,
    currentVersion: CURRENT_TOS_VERSION,
    acceptedVersion: user?.tosVersion || null,
    acceptedAt: user?.tosAcceptedAt?.toISOString() || null,
  };
}

/**
 * Record the user's acceptance of the current TOS version.
 */
export async function acceptTos(): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await dbc.user.update({
      where: { id: session.user.id },
      data: {
        tosAcceptedAt: new Date(),
        tosVersion: CURRENT_TOS_VERSION,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[tos] Acceptance error:", error);
    return { success: false, error: "Failed to save acceptance" };
  }
}

/**
 * Force re-affirmation for a user (called when role/status changes).
 * Clears tosAcceptedAt so the gate triggers on next page load.
 */
export async function requireReaffirmation(
  userId: string
): Promise<{ success: boolean }> {
  try {
    await dbc.user.update({
      where: { id: userId },
      data: { tosAcceptedAt: null, tosVersion: null },
    });
    return { success: true };
  } catch (error) {
    console.error("[tos] Re-affirmation error:", error);
    return { success: false };
  }
}
