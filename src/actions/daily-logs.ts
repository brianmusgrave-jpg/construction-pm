"use server";

import { db } from "@/lib/db-types";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getDailyLogs(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  return db.dailyLog.findMany({
    where: { projectId },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { date: "desc" },
    take: 30,
  });
}

export async function createDailyLog(data: {
  projectId: string;
  date: string;
  weather?: string;
  tempHigh?: number;
  tempLow?: number;
  crewCount?: number;
  equipment?: string;
  workSummary: string;
  issues?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const log = await db.dailyLog.create({
    data: {
      projectId: data.projectId,
      date: new Date(data.date),
      weather: data.weather ?? null,
      tempHigh: data.tempHigh ?? null,
      tempLow: data.tempLow ?? null,
      crewCount: data.crewCount ?? null,
      equipment: data.equipment ?? null,
      workSummary: data.workSummary,
      issues: data.issues ?? null,
      notes: data.notes ?? null,
      authorId: session.user.id,
    },
  });

  revalidatePath(`/dashboard/projects/${data.projectId}`);
  return log;
}

export async function deleteDailyLog(logId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const log = await db.dailyLog.findUnique({ where: { id: logId } });
  if (!log) throw new Error("Log not found");

  // Only the author or admin can delete
  const userRole = session.user.role ?? "VIEWER";
  if (log.authorId !== session.user.id && userRole !== "ADMIN") {
    throw new Error("Forbidden");
  }

  await db.dailyLog.delete({ where: { id: logId } });
  revalidatePath(`/dashboard/projects/${log.projectId}`);
  return { success: true };
}
