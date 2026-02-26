"use server";

/**
 * @file actions/rfi.ts
 * @description Server actions for RFI (Request for Information) management.
 *
 * RFIs are formal information requests issued by contractors or project managers
 * to resolve ambiguities in drawings, specs, or scope. Lifecycle:
 *   OPEN → ANSWERED → CLOSED  (or OPEN → VOID)
 *
 * Sequential numbering: each RFI gets a per-phase rfiNumber (count + 1).
 * This is a display number, not a DB auto-increment — gaps are possible if
 * RFIs are deleted.
 *
 * All functions use `dbc = db as any` because the RFI model was added after
 * the last Prisma client generation. See GLOBAL_PROJECT_STANDARDS.md §3.
 *
 * Date fields serialised with `.toISOString?.()` for safe server→client transfer.
 *
 * Requires: authenticated session. Write operations require "phase" permission
 * via `can()` from @/lib/permissions.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// ── Queries ──

/**
 * Fetch all RFIs for a phase, including assignee and author details.
 *
 * Ordered by status (ASC) then rfiNumber (ASC) so open items surface first
 * and are listed in submission order within each status group.
 *
 * All Date fields are serialised to ISO strings for safe server→client transfer.
 *
 * @param phaseId - The phase to fetch RFIs for.
 * @returns Array of RFI objects with serialised dates.
 */
export async function getRFIs(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  const dbc = db as any;
  const items = await dbc.rFI.findMany({
    where: { phaseId },
    include: {
      assignedTo: { select: { id: true, name: true, company: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { rfiNumber: "asc" }],
  });

  // Serialise all Date fields — Prisma returns Date objects, which cannot
  // be passed directly across the server→client boundary in Next.js.
  return items.map((item: any) => ({
    ...item,
    createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
    dueDate: item.dueDate?.toISOString?.() ?? item.dueDate,
    answeredAt: item.answeredAt?.toISOString?.() ?? item.answeredAt,
    closedAt: item.closedAt?.toISOString?.() ?? item.closedAt,
  }));
}

// ── Mutations ──

/**
 * Create a new RFI on a phase.
 *
 * rfiNumber is assigned sequentially (current count + 1). This is a display
 * number for the RFI log, not a DB auto-increment — it may contain gaps if
 * previous RFIs were deleted.
 *
 * Initial status is always OPEN.
 *
 * @param data.phaseId      - Phase to attach the RFI to.
 * @param data.subject      - Short subject line (trimmed).
 * @param data.question     - Full question body (trimmed).
 * @param data.priority     - e.g. "LOW" | "MEDIUM" | "HIGH" | "URGENT".
 * @param data.ballInCourt  - Which party currently holds the RFI (optional).
 * @param data.assignedToId - User ID of the person responsible (optional).
 * @param data.dueDate      - ISO date string for response deadline (optional).
 * @returns The newly created RFI record.
 * @throws "No permission" if the caller lacks create:phase permission.
 */
export async function createRFI(data: {
  phaseId: string;
  subject: string;
  question: string;
  priority: string;
  ballInCourt?: string;
  assignedToId?: string;
  dueDate?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "create", "phase")) throw new Error("No permission");

  const dbc = db as any;
  // Sequential display number — not a DB auto-increment.
  // May have gaps if RFIs are deleted; used for log display only.
  const count = await dbc.rFI.count({ where: { phaseId: data.phaseId } });
  const rfiNumber = count + 1;

  const item = await dbc.rFI.create({
    data: {
      phaseId: data.phaseId,
      rfiNumber,
      subject: data.subject.trim(),
      question: data.question.trim(),
      priority: data.priority,
      status: "OPEN",
      ballInCourt: data.ballInCourt?.trim() || null,
      assignedToId: data.assignedToId || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      createdById: session.user.id,
    },
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

/**
 * Record an answer to an open RFI and transition its status to ANSWERED.
 *
 * Sets `answeredAt` to the current timestamp automatically.
 * The RFI can still be closed explicitly via `updateRFIStatus`.
 *
 * @param rfiId  - ID of the RFI to answer.
 * @param answer - The answer text (trimmed before storage).
 * @returns The updated RFI record.
 * @throws "No permission" if the caller lacks update:phase permission.
 */
export async function answerRFI(rfiId: string, answer: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "phase")) throw new Error("No permission");

  const dbc = db as any;
  const item = await dbc.rFI.update({
    where: { id: rfiId },
    data: {
      answer: answer.trim(),
      status: "ANSWERED",
      answeredAt: new Date(),
    },
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

/**
 * Transition an RFI to a new status (e.g. CLOSED, VOID).
 *
 * When transitioning to CLOSED, `closedAt` is automatically set to now.
 * Use `answerRFI` when the intent is specifically to record an answer —
 * this function is for explicit status overrides only.
 *
 * @param rfiId  - ID of the RFI to update.
 * @param status - New status string (e.g. "CLOSED", "VOID", "OPEN").
 * @returns The updated RFI record.
 * @throws "No permission" if the caller lacks update:phase permission.
 */
export async function updateRFIStatus(rfiId: string, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "phase")) throw new Error("No permission");

  const dbc = db as any;
  const updateData: any = { status };
  // Automatically record when the RFI was closed for audit/reporting.
  if (status === "CLOSED") updateData.closedAt = new Date();

  const item = await dbc.rFI.update({
    where: { id: rfiId },
    data: updateData,
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

/**
 * Permanently delete an RFI.
 *
 * Note: remaining RFIs are NOT renumbered — gaps in rfiNumber are expected
 * and acceptable for audit trail purposes.
 *
 * @param rfiId - ID of the RFI to delete.
 * @throws "No permission" if the caller lacks delete:phase permission (PM+).
 */
export async function deleteRFI(rfiId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "delete", "phase")) throw new Error("No permission");

  const dbc = db as any;
  await dbc.rFI.delete({ where: { id: rfiId } });
  revalidatePath(`/dashboard/projects`);
}
