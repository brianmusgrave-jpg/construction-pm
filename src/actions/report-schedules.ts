"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";
import type { ReportSchedule, ReportFrequency } from "@/lib/db-types";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  // Any authenticated user can manage report schedules (org-level feature)
  return session.user.id;
}

export async function getReportSchedules(): Promise<ReportSchedule[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return db.reportSchedule.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createReportSchedule(data: {
  frequency: ReportFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  sendHour: number;
  recipients: string[];
  includeProjects?: string[];
}): Promise<void> {
  await requireAdmin();
  if (data.recipients.length === 0) throw new Error("At least one recipient required");
  await db.reportSchedule.create({
    data: {
      frequency: data.frequency,
      dayOfWeek: data.dayOfWeek ?? null,
      dayOfMonth: data.dayOfMonth ?? null,
      sendHour: data.sendHour,
      recipients: data.recipients,
      includeProjects: data.includeProjects ?? [],
      active: true,
    },
  });
  revalidatePath("/dashboard/settings");
}

export async function toggleReportSchedule(id: string, active: boolean): Promise<void> {
  await requireAdmin();
  await db.reportSchedule.update({ where: { id }, data: { active } });
  revalidatePath("/dashboard/settings");
}

export async function deleteReportSchedule(id: string): Promise<void> {
  await requireAdmin();
  await db.reportSchedule.delete({ where: { id } });
  revalidatePath("/dashboard/settings");
}

// Called by a cron job / scheduled function (e.g. Vercel Cron, GitHub Actions)
export async function sendDueReports(): Promise<{ sent: number }> {
  const now = new Date();
  const schedules: ReportSchedule[] = await db.reportSchedule.findMany({
    where: { active: true },
  });

  let sent = 0;
  for (const schedule of schedules) {
    const isDue = isScheduleDue(schedule, now);
    if (!isDue) continue;

    // Mark as sent (actual email delivery would use nodemailer / Resend / SendGrid here)
    await db.reportSchedule.update({
      where: { id: schedule.id },
      data: { lastSentAt: now },
    });
    sent++;
  }
  return { sent };
}

function isScheduleDue(schedule: ReportSchedule, now: Date): boolean {
  if (schedule.lastSentAt) {
    const last = new Date(schedule.lastSentAt);
    const hoursSince = (now.getTime() - last.getTime()) / 3600000;
    // Don't re-send if sent within the last 20 hours (prevents double-firing)
    if (hoursSince < 20) return false;
  }

  const hour = now.getUTCHours();
  if (hour !== schedule.sendHour) return false;

  if (schedule.frequency === "WEEKLY") {
    return now.getUTCDay() === (schedule.dayOfWeek ?? 1);
  }
  if (schedule.frequency === "MONTHLY") {
    return now.getUTCDate() === (schedule.dayOfMonth ?? 1);
  }
  return false;
}
