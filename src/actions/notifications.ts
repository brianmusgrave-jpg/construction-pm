"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

  return {
    notifications,
    total,
    hasMore: skip + notifications.length < total,
  };
}

export async function getUnreadCount(): Promise<number> {
  const session = await auth();
  if (!session?.user) return 0;

  try {
    const count = await db.notification.count({
      where: { userId: session.user.id, read: false },
    });
    return count;
  } catch {
    return 0; // Table might not exist yet during first deploy
  }
}

export async function markAsRead(notificationId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { read: true },
  });

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/contractor");
  return { success: true };
}

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
