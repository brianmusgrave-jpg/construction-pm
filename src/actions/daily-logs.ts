"use server";

import { db } from "@/lib/db-types";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateDailyLogSchema = z.object({
  projectId: z.string().min(1),
  date: z.string().min(1),
  weather: z.string().max(100).optional(),
  tempHigh: z.number().optional(),
  tempLow: z.number().optional(),
  crewCount: z.number().nonnegative().optional(),
  equipment: z.string().max(2000).optional(),
  workSummary: z.string().min(1).max(5000),
  issues: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
});

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
  const validated = CreateDailyLogSchema.parse(data);

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
