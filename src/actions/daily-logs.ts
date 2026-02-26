"use server";

/**
 * @file actions/daily-logs.ts
 * @description Server actions for daily field log creation and management.
 *
 * Daily logs are per-project journal entries capturing on-site conditions,
 * crew activity, equipment, and work summaries for a given date. They serve
 * as a legal/contractual record of daily site activity.
 *
 * Fields captured:
 *   - Date, weather conditions (description + high/low temp)
 *   - Crew count and equipment on site
 *   - Work summary (required), issues encountered, miscellaneous notes
 *
 * Auth rules:
 *   - Read/create: any authenticated user
 *   - Delete: the log's author OR an ADMIN (prevents tampering by others)
 *
 * Pagination: `getDailyLogs` returns the 30 most recent logs. For larger
 * date ranges, pagination can be added to this action.
 */

import { db } from "@/lib/db-types";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Zod Schema ──

/** Validates daily log creation input. */
const CreateDailyLogSchema = z.object({
  projectId:   z.string().min(1),
  date:        z.string().min(1),             // ISO date string
  weather:     z.string().max(100).optional(),
  tempHigh:    z.number().optional(),         // Fahrenheit
  tempLow:     z.number().optional(),
  crewCount:   z.number().nonnegative().optional(),
  equipment:   z.string().max(2000).optional(),
  workSummary: z.string().min(1).max(5000),   // Required — core log content
  issues:      z.string().max(5000).optional(),
  notes:       z.string().max(5000).optional(),
});

// ── Queries ──

/**
 * Fetch the 30 most recent daily logs for a project, newest first.
 * Includes the author's id/name/email for the log header display.
 *
 * Requires: authenticated session.
 */
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

// ── Mutations ──

/**
 * Create a new daily log entry for a project.
 * The current session user is recorded as the author.
 *
 * Requires: authenticated session.
 */
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
      projectId:   validated.projectId,
      date:        new Date(validated.date),
      weather:     validated.weather ?? null,
      tempHigh:    validated.tempHigh ?? null,
      tempLow:     validated.tempLow ?? null,
      crewCount:   validated.crewCount ?? null,
      equipment:   validated.equipment ?? null,
      workSummary: validated.workSummary,
      issues:      validated.issues ?? null,
      notes:       validated.notes ?? null,
      authorId:    session.user.id,
    },
  });

  revalidatePath(`/dashboard/projects/${validated.projectId}`);
  return log;
}

/**
 * Delete a daily log entry.
 * Only the original author or an ADMIN may delete — prevents other team
 * members from altering the site record history.
 *
 * Requires: authenticated session (author or ADMIN).
 */
export async function deleteDailyLog(logId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const log = await db.dailyLog.findUnique({ where: { id: logId } });
  if (!log) throw new Error("Log not found");

  // Ownership check — only the author or an admin can delete
  const userRole = session.user.role ?? "VIEWER";
  if (log.authorId !== session.user.id && userRole !== "ADMIN") {
    throw new Error("Forbidden");
  }

  await db.dailyLog.delete({ where: { id: logId } });
  revalidatePath(`/dashboard/projects/${log.projectId}`);
  return { success: true };
}
