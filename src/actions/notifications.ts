"use server";

/**
 * @file actions/notifications.ts
 * @description Server actions for the user notification inbox.
 *
 * Notifications are created server-side by `notify()` in `src/lib/notifications.ts`
 * and delivered to the client via the SSE endpoint (`/api/notifications/stream`).
 * This file handles the read/manage side: fetching the inbox, marking as read,
 * and deleting entries.
 *
 * All operations are scoped to the current session user — a user can only see,
 * mark, and delete their own notifications. The `updateMany`/`deleteMany` pattern
 * (rather than `update`/`delete`) implicitly enforces this by including `userId`
 * in the where clause, making ID-guessing attacks harmless.
 *
 * Pagination: `getNotifications` supports cursor-less page/limit pagination.
 * The response includes `hasMore` for the "load more" button in the inbox UI.
 *
 * Revalidation: All mutations revalidate the notification bell (in the dashboard
 * header) and the contractor portal header, as both display unread counts.
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── Queries ──

/**
 * Fetch a paginated page of notifications for the current user, newest first.
 * Returns the page data, total count, and whether more pages are available.
 *
 * The `data` field is cast from Prisma's `JsonValue` to `Record<string, unknown>`
 * for safe use in client components.
 *
 * Requires: authenticated session.
 */
export async function getNotifications(page: number = 1, limit: number = 20) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.notification.count({
      where: { userId: session.user.id },
    }),
  ]);

  // Cast Prisma JsonValue to Record<string, unknown> for safe client consumption
  const mapped = notifications.map((n: typeof notifications[number]) => ({
    ...n,
    data: (n.data as Record<string, unknown> | null),
  }));

  return {
    notifications: mapped,
    total,
    hasMore: skip + mapped.length < total,
  };
}

/**
 * Return the count of unread notifications for the current user.
 * Used by the notification bell badge in the nav header.
 * Returns 0 for unauthenticated users or if the DB query fails
 * (graceful fallback for fresh deploys where the table may not exist yet).
 */
export async function getUnreadCount(): Promise<number> {
  const session = await auth();
  if (!session?.user) return 0;

  try {
    const count = await db.notification.count({
      where: { userId: session.user.id, read: false },
    });
    return count;
  } catch {
    return 0; // Table might not exist yet during first deploy — fail silently
  }
}

// ── Mutations ──

/**
 * Mark a single notification as read.
 * Uses `updateMany` with `userId` in the where clause to prevent cross-user writes.
 *
 * Requires: authenticated session.
 */
export async function markAsRead(notificationId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { read: true },
  });

  // Revalidate all surfaces that display the unread badge or inbox
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/contractor");
  return { success: true };
}

/**
 * Mark all unread notifications for the current user as read.
 * Returns the count of updated records.
 *
 * Requires: authenticated session.
 */
export async function markAllAsRead() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const result = await db.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/contractor");
  return { updated: result.count };
}

/**
 * Delete a single notification from the user's inbox.
 * Uses `deleteMany` with `userId` to ensure cross-user deletion is impossible.
 *
 * Requires: authenticated session.
 */
export async function deleteNotification(notificationId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.notification.deleteMany({
    where: { id: notificationId, userId: session.user.id },
  });

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  return { success: true };
}
