"use server";

/**
 * @file actions/timeEntry.ts
 * @description Server actions for phase-level labour time entry and approval.
 *
 * Time entries record hours worked by staff members on a specific phase and date.
 * Each entry flows through a simple two-state approval workflow:
 *
 *   PENDING → APPROVED
 *           → REJECTED
 *
 * Role requirements (via `can()` from @/lib/permissions):
 *   - Create entry:  can(role, "create", "phase")  — CONTRACTOR and above
 *   - Approve/Reject: can(role, "manage", "phase") — PROJECT_MANAGER and above
 *   - Delete entry:  can(role, "delete", "phase")  — PROJECT_MANAGER and above
 *
 * Note on `db as any` (`dbc`) cast:
 *   The `timeEntry` model was added after the primary Prisma client was generated.
 *   It is not present in the typed Prisma client exported from `@/lib/db`, so all
 *   accesses go through a `db as any` cast (`dbc`) until the schema is regenerated
 *   and the types are updated. See GLOBAL_PROJECT_STANDARDS.md §3 for the pattern.
 *
 * Date serialisation:
 *   `getTimeEntries` normalises all Date objects to ISO strings before returning —
 *   Prisma Date objects are not serialisable across the server→client boundary.
 *
 * Cache revalidation:
 *   All mutations revalidate `/dashboard/projects` (the broad path) rather than
 *   the specific project path because time entries are often viewed in a
 *   cross-project labour report where the projectId is not immediately available.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// ── Queries ──

/**
 * Fetch all time entries for a phase, sorted by date descending (most recent first).
 * Includes the worker's name/company and the entry creator's name for display.
 *
 * All Date fields are serialised to ISO strings before return.
 *
 * @param phaseId - Phase to fetch time entries for.
 */
export async function getTimeEntries(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  // dbc: db as any — timeEntry not in generated Prisma types yet
  const dbc = db as any;
  const items = await dbc.timeEntry.findMany({
    where: { phaseId },
    include: {
      worker: { select: { id: true, name: true, company: true, role: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  // Serialise all Date fields — Prisma Dates are not server→client safe
  return items.map((item: any) => ({
    ...item,
    date: item.date?.toISOString?.() ?? item.date,
    createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
    approvedAt: item.approvedAt?.toISOString?.() ?? item.approvedAt,
  }));
}

/**
 * Aggregate time entry hours for a phase into a summary object.
 * Used by phase detail KPI cards ("X hours logged, Y approved").
 *
 * @param phaseId - Phase to summarise.
 * @returns `{ totalHours, approvedHours, pendingHours, entryCount }`
 */
export async function getTimeSummary(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  const dbc = db as any;
  const entries = await dbc.timeEntry.findMany({
    where: { phaseId },
    select: { hours: true, status: true, costCode: true },
  });

  const totalHours = entries.reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
  const approvedHours = entries
    .filter((e: any) => e.status === "APPROVED")
    .reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
  const pendingHours = entries
    .filter((e: any) => e.status === "PENDING")
    .reduce((sum: number, e: any) => sum + (e.hours || 0), 0);

  return { totalHours, approvedHours, pendingHours, entryCount: entries.length };
}

// ── Mutations ──

/**
 * Log hours worked for a staff member on a phase.
 * New entries start with status "PENDING" pending PM approval.
 *
 * Requires: can(role, "create", "phase") — CONTRACTOR and above.
 *
 * @param data.phaseId      - Phase the work was performed on.
 * @param data.workerId     - Staff ID of the worker.
 * @param data.date         - Work date (ISO date string, e.g. "2025-06-15").
 * @param data.hours        - Hours worked (positive number).
 * @param data.costCode     - Optional cost code for job costing (trimmed).
 * @param data.description  - Optional work description (trimmed).
 * @returns The created TimeEntry record.
 */
export async function createTimeEntry(data: {
  phaseId: string;
  workerId: string;
  date: string;
  hours: number;
  costCode?: string;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "create", "phase")) throw new Error("No permission");

  const dbc = db as any;
  const item = await dbc.timeEntry.create({
    data: {
      phaseId: data.phaseId,
      workerId: data.workerId,
      date: new Date(data.date),
      hours: data.hours,
      costCode: data.costCode?.trim() || null,
      description: data.description?.trim() || null,
      status: "PENDING", // Entries require PM approval before contributing to cost reports
      createdById: session.user.id,
    },
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

/**
 * Approve a pending time entry.
 * Sets status to APPROVED, records `approvedAt` and `approvedById`.
 *
 * Requires: can(role, "manage", "phase") — PROJECT_MANAGER and above.
 *
 * @param entryId - ID of the TimeEntry to approve.
 * @returns The updated TimeEntry record.
 */
export async function approveTimeEntry(entryId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("No permission");

  const dbc = db as any;
  const item = await dbc.timeEntry.update({
    where: { id: entryId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById: session.user.id,
    },
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

/**
 * Reject a pending time entry.
 * Sets status to REJECTED. The entry remains in the DB for audit purposes.
 *
 * Requires: can(role, "manage", "phase") — PROJECT_MANAGER and above.
 *
 * @param entryId - ID of the TimeEntry to reject.
 * @returns The updated TimeEntry record.
 */
export async function rejectTimeEntry(entryId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("No permission");

  const dbc = db as any;
  const item = await dbc.timeEntry.update({
    where: { id: entryId },
    data: { status: "REJECTED" },
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

/**
 * Permanently delete a time entry.
 * Use for data entry errors; approved entries should typically not be deleted.
 *
 * Requires: can(role, "delete", "phase") — PROJECT_MANAGER and above.
 *
 * @param entryId - ID of the TimeEntry to delete.
 */
export async function deleteTimeEntry(entryId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "delete", "phase")) throw new Error("No permission");

  const dbc = db as any;
  await dbc.timeEntry.delete({ where: { id: entryId } });
  revalidatePath(`/dashboard/projects`);
}
