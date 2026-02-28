"use server";

/**
 * @file actions/submittal.ts
 * @description Server actions for submittal management.
 *
 * Submittals are documents (shop drawings, product data, samples) submitted
 * by contractors for architect/engineer review before construction proceeds.
 * Lifecycle:
 *   PENDING → APPROVED | APPROVED_AS_NOTED | REJECTED | REVISE_AND_RESUBMIT
 *
 * Revision tracking: `reviseSubmittal` bumps the revision counter and resets
 * status to PENDING, allowing a resubmission cycle. `returnedAt` is cleared
 * on revision to track only the most recent return date.
 *
 * Sequential numbering: `submittalNumber` is assigned as count + 1 per phase.
 * Gaps are possible if submittals are deleted (display number only).
 *
 * All functions use `dbc = db as any` — the Submittal model was added after
 * the last Prisma client generation. See GLOBAL_PROJECT_STANDARDS.md §3.
 *
 * Date fields serialised with `.toISOString?.()` for safe server→client transfer.
 *
 * Requires: authenticated session. Writes require "phase" permission via
 * `can()` from @/lib/permissions.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// ── Queries ──

/**
 * Fetch all submittals for a phase, with assignee and submitter details.
 *
 * Ordered by status (ASC) then submittalNumber (ASC) so pending items
 * surface first, listed in submission order.
 *
 * All Date fields serialised to ISO strings for server→client safety.
 *
 * @param phaseId - The phase to fetch submittals for.
 * @returns Array of submittal objects with serialised dates.
 */
export async function getSubmittals(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  const dbc = db as any;
  const items = await dbc.submittal.findMany({
    where: { phaseId },
    include: {
      assignedTo: { select: { id: true, name: true, company: true } },
      submittedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { submittalNumber: "asc" }],
  });

  // Serialise Date fields — Prisma returns Date objects which cannot cross
  // the server→client boundary in Next.js without conversion.
  return items.map((item: any) => ({
    ...item,
    createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
    dueDate: item.dueDate?.toISOString?.() ?? item.dueDate,
    returnedAt: item.returnedAt?.toISOString?.() ?? item.returnedAt,
  }));
}

// ── Mutations ──

/**
 * Create a new submittal on a phase.
 *
 * `submittalNumber` is assigned as count + 1 — a display number that may
 * contain gaps if previous submittals were deleted.
 *
 * Initial state: status PENDING, revision 0 (first submission).
 *
 * @param data.phaseId      - Phase to attach the submittal to.
 * @param data.title        - Short title (trimmed).
 * @param data.specSection  - Specification section reference (optional).
 * @param data.description  - Longer description (optional, trimmed).
 * @param data.assignedToId - Reviewer's user ID (optional).
 * @param data.dueDate      - ISO date string for review deadline (optional).
 * @returns The newly created submittal record.
 * @throws "No permission" if the caller lacks create:phase permission.
 */
export async function createSubmittal(data: {
  phaseId: string;
  title: string;
  specSection?: string;
  description?: string;
  assignedToId?: string;
  dueDate?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "create", "phase")) throw new Error("No permission");

  const dbc = db as any;
  // Sequential display number — gaps possible after deletions.
  const count = await dbc.submittal.count({ where: { phaseId: data.phaseId } });
  const submittalNumber = count + 1;

  const item = await dbc.submittal.create({
    data: {
      phaseId: data.phaseId,
      submittalNumber,
      title: data.title.trim(),
      specSection: data.specSection?.trim() || null,
      description: data.description?.trim() || null,
      status: "PENDING",
      revision: 0,               // First submission is always revision 0
      assignedToId: data.assignedToId || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      submittedById: session.user.id,
    },
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

/**
 * Update the review status of a submittal.
 *
 * Terminal review statuses (APPROVED, APPROVED_AS_NOTED, REJECTED,
 * REVISE_AND_RESUBMIT) automatically set `returnedAt` to now, recording
 * when the review was returned to the submitter. `returnedAt` is cleared
 * when a revision is created via `reviseSubmittal`.
 *
 * @param submittalId - ID of the submittal to update.
 * @param status      - New status string.
 * @returns The updated submittal record.
 * @throws "No permission" if the caller lacks update:phase permission.
 */
export async function updateSubmittalStatus(
  submittalId: string,
  status: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "phase")) throw new Error("No permission");

  const dbc = db as any;
  const updateData: any = { status };
  // Record the return date when the submittal reaches a terminal review state.
  if (["APPROVED", "APPROVED_AS_NOTED", "REJECTED", "REVISE_AND_RESUBMIT"].includes(status)) {
    updateData.returnedAt = new Date();
  }

  const item = await dbc.submittal.update({
    where: { id: submittalId },
    data: updateData,
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

/**
 * Create a new revision of a rejected or commented submittal.
 *
 * Increments `revision` by 1, resets status to PENDING, and clears
 * `returnedAt` so the review cycle restarts cleanly. The revision number
 * tracks how many times this submittal has been resubmitted.
 *
 * Typical flow:
 *   REVISE_AND_RESUBMIT → reviseSubmittal() → PENDING (rev 1)
 *   → APPROVED_AS_NOTED → reviseSubmittal() → PENDING (rev 2) → APPROVED
 *
 * @param submittalId - ID of the submittal to revise.
 * @returns The updated submittal record with bumped revision number.
 * @throws "No permission" if the caller lacks update:phase permission.
 * @throws "Submittal not found" if the ID is invalid.
 */
export async function reviseSubmittal(submittalId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "phase")) throw new Error("No permission");

  const dbc = db as any;
  const current = await dbc.submittal.findUnique({ where: { id: submittalId } });
  if (!current) throw new Error("Submittal not found");

  const item = await dbc.submittal.update({
    where: { id: submittalId },
    data: {
      revision: current.revision + 1,
      status: "PENDING",
      returnedAt: null,           // Clear return date for fresh review cycle
    },
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

/**
 * Permanently delete a submittal.
 *
 * Does not renumber remaining submittals — gaps in submittalNumber are
 * acceptable for audit trail purposes.
 *
 * @param submittalId - ID of the submittal to delete.
 * @throws "No permission" if the caller lacks delete:phase permission (PM+).
 */
export async function deleteSubmittal(submittalId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "delete", "phase")) throw new Error("No permission");

  const dbc = db as any;
  await dbc.submittal.delete({ where: { id: submittalId } });
  revalidatePath(`/dashboard/projects`);
}
