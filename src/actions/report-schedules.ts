"use server";

/**
 * @file actions/report-schedules.ts
 * @description Server actions for automated report delivery scheduling.
 *
 * Report schedules allow ADMIN/PM users to configure automatic periodic email
 * delivery of project health summaries to a list of recipients. Schedules are
 * evaluated by a cron job that calls `sendDueReports()` once per hour.
 *
 * Supported frequencies:
 *   - WEEKLY  — fires on a specific UTC day-of-week (0=Sunday … 6=Saturday)
 *   - MONTHLY — fires on a specific UTC day-of-month (1–31)
 *
 * Duplicate-fire protection:
 *   `isScheduleDue()` checks that `lastSentAt` is more than 20 hours ago before
 *   allowing another delivery. This prevents double-firing if the cron job is
 *   triggered more frequently than the schedule period.
 *
 * Delivery:
 *   `sendDueReports()` marks each due schedule as sent and returns a count.
 *   The actual email delivery (nodemailer / Resend / SendGrid) is intentionally
 *   omitted from this stub and must be wired up by the implementing developer.
 *
 * Note: `requireAdmin()` here is slightly mis-named — it actually allows any
 * authenticated user to manage schedules (the comment in the original code
 * says "any authenticated user can manage report schedules"). The function name
 * is kept as-is for backward compatibility.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";
import type { ReportSchedule, ReportFrequency } from "@/lib/db-types";

// ── Auth helper ──

/**
 * Assert an active session and return the user ID.
 * Despite the name, this allows ANY authenticated user — report schedule
 * management is treated as an org-level (not role-gated) feature.
 */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  return session.user.id;
}

// ── Queries ──

/**
 * Fetch all report schedules, newest first.
 * Returns an empty array for unauthenticated callers (safe for server components).
 */
export async function getReportSchedules(): Promise<ReportSchedule[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return db.reportSchedule.findMany({ where: { orgId: session.user.orgId! }, orderBy: { createdAt: "desc" } });
}

// ── Mutations ──

/**
 * Create a new report schedule.
 *
 * @param data.frequency      - WEEKLY or MONTHLY.
 * @param data.dayOfWeek      - UTC day of week (0–6); required when frequency = WEEKLY.
 * @param data.dayOfMonth     - UTC day of month (1–31); required when frequency = MONTHLY.
 * @param data.sendHour       - UTC hour (0–23) at which to dispatch the report.
 * @param data.recipients     - Email addresses to send the report to (at least one required).
 * @param data.includeProjects - Optional project IDs to restrict the report scope.
 *                              Empty array or undefined = all projects.
 */
export async function createReportSchedule(data: {
  frequency: ReportFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  sendHour: number;
  recipients: string[];
  includeProjects?: string[];
}): Promise<void> {
  await requireAdmin();
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (data.recipients.length === 0) throw new Error("At least one recipient required");
  await db.reportSchedule.create({
    data: {
      orgId: session.user.orgId!,
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

/**
 * Enable or disable a schedule without deleting it.
 * Use this to temporarily pause delivery without losing the configuration.
 *
 * @param id     - Schedule ID to toggle.
 * @param active - `true` to re-enable, `false` to pause.
 */
export async function toggleReportSchedule(id: string, active: boolean): Promise<void> {
  await requireAdmin();
  await db.reportSchedule.update({ where: { id }, data: { active } });
  revalidatePath("/dashboard/settings");
}

/**
 * Permanently delete a report schedule.
 * Use `toggleReportSchedule(id, false)` to pause without deleting.
 */
export async function deleteReportSchedule(id: string): Promise<void> {
  await requireAdmin();
  await db.reportSchedule.delete({ where: { id } });
  revalidatePath("/dashboard/settings");
}

// ── Cron job entry point ──

/**
 * Evaluate all active schedules and send reports for any that are due.
 * Intended to be called by a Vercel Cron job or equivalent scheduled function
 * every hour (e.g. `0 * * * *`).
 *
 * For each due schedule:
 *   1. Records `lastSentAt = now` to prevent duplicate delivery.
 *   2. (TODO) Dispatches the actual report email via the configured mailer.
 *
 * @returns `{ sent }` — the number of reports dispatched in this run.
 */
export async function sendDueReports(): Promise<{ sent: number }> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const now = new Date();
  const schedules: ReportSchedule[] = await db.reportSchedule.findMany({
    where: { orgId: session.user.orgId!, active: true },
  });

  let sent = 0;
  for (const schedule of schedules) {
    const isDue = isScheduleDue(schedule, now);
    if (!isDue) continue;

    // Persist the sent timestamp BEFORE dispatching to avoid double-send on retry
    // TODO: wire up nodemailer / Resend / SendGrid here and send the actual report
    await db.reportSchedule.update({
      where: { id: schedule.id },
      data: { lastSentAt: now },
    });
    sent++;
  }
  return { sent };
}

// ── Helpers ──

/**
 * Determine whether a schedule should fire at the given `now` timestamp.
 *
 * Rules (all must pass):
 *   1. Not sent in the last 20 hours — prevents double-fire on frequent cron runs.
 *   2. Current UTC hour matches `sendHour`.
 *   3. For WEEKLY: current UTC day-of-week matches `dayOfWeek` (default Monday=1).
 *   4. For MONTHLY: current UTC date matches `dayOfMonth` (default 1st).
 *
 * @param schedule - The schedule record from the DB.
 * @param now      - Reference timestamp (typically `new Date()` from the caller).
 */
function isScheduleDue(schedule: ReportSchedule, now: Date): boolean {
  if (schedule.lastSentAt) {
    const last = new Date(schedule.lastSentAt);
    const hoursSince = (now.getTime() - last.getTime()) / 3600000;
    // 20-hour buffer prevents duplicate delivery on hourly cron runs
    if (hoursSince < 20) return false;
  }

  const hour = now.getUTCHours();
  if (hour !== schedule.sendHour) return false;

  if (schedule.frequency === "WEEKLY") {
    // dayOfWeek: 0=Sunday, 1=Monday, …, 6=Saturday (UTC)
    return now.getUTCDay() === (schedule.dayOfWeek ?? 1);
  }
  if (schedule.frequency === "MONTHLY") {
    // dayOfMonth: 1–31 (UTC)
    return now.getUTCDate() === (schedule.dayOfMonth ?? 1);
  }
  return false;
}
