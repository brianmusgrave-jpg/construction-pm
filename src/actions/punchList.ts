"use server";

/**
 * @file actions/punchList.ts
 * @description Server actions for the project punch list (deficiency/defect tracking).
 *
 * A punch list is the construction industry's "snagging list" — items that must be
 * corrected, completed, or verified before a phase or project can be closed out.
 * Each punch list item has a priority level and progresses through:
 *
 *   OPEN → IN_PROGRESS → READY_FOR_REVIEW → CLOSED
 *
 * Item numbering:
 *   `itemNumber` is a sequential per-phase counter (1, 2, 3…) auto-assigned
 *   at creation time based on the current item count. It is NOT a DB-level
 *   auto-increment — concurrent creates could produce duplicates, but this is
 *   acceptable given the low concurrency of typical field operations.
 *
 * Priority levels (from highest to lowest):
 *   CRITICAL — safety or occupancy-blocking issues
 *   HIGH     — affects use but not occupancy
 *   MEDIUM   — cosmetic or functional non-critical
 *   LOW      — deferred/nice-to-have
 *
 * `closedAt` is auto-set when status transitions to CLOSED.
 *
 * Note on `db as any` (`dbc`) cast:
 *   `punchListItem` is not present in the generated Prisma client types —
 *   see GLOBAL_PROJECT_STANDARDS.md §3.
 *
 * Role requirements (all use `can()` from @/lib/permissions, scoped to "phase"):
 *   - Create: can(role, "create", "phase") — CONTRACTOR and above
 *   - Update: can(role, "update", "phase") — CONTRACTOR and above
 *   - Delete: can(role, "delete", "phase") — PROJECT_MANAGER and above
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// ── Queries ──

/**
 * Fetch all punch list items for a phase.
 * Sorted by status (open items first), then priority, then newest first.
 * Includes the assigned staff member and the item creator for display.
 *
 * All Date fields are serialised to ISO strings before return.
 *
 * @param phaseId - Phase to fetch punch list items for.
 */
export async function getPunchListItems(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  // dbc: db as any — punchListItem not in generated Prisma types yet
  const dbc = db as any;
  const items = await dbc.punchListItem.findMany({
    where: { phaseId },
    include: {
      assignedTo: { select: { id: true, name: true, company: true } },
      createdBy: { select: { id: true, name: true } },
    },
    // Open items surface before closed; critical priority before low within each status
    orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
  });

  // Serialise all Date fields — Prisma Dates are not server→client safe
  return items.map((item: any) => ({
    ...item,
    createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
    dueDate: item.dueDate?.toISOString?.() ?? item.dueDate,
    closedAt: item.closedAt?.toISOString?.() ?? item.closedAt,
  }));
}

/**
 * Summarise punch list status and critical count for a project's dashboard card.
 * Aggregates across all phases in the project.
 *
 * @param projectId - Project to summarise.
 * @returns `{ total, open, inProgress, readyForReview, closed, critical }`
 *   where `critical` = open CRITICAL-priority items (closed ones excluded).
 */
export async function getPunchListSummary(projectId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  const dbc = db as any;
  const items = await dbc.punchListItem.findMany({
    where: { phase: { projectId } },
    select: { status: true, priority: true },
  });

  return {
    total: items.length,
    open: items.filter((i: any) => i.status === "OPEN").length,
    inProgress: items.filter((i: any) => i.status === "IN_PROGRESS").length,
    readyForReview: items.filter((i: any) => i.status === "READY_FOR_REVIEW").length,
    closed: items.filter((i: any) => i.status === "CLOSED").length,
    // Critical = safety/occupancy-blocking items that aren't yet closed
    critical: items.filter((i: any) => i.priority === "CRITICAL" && i.status !== "CLOSED").length,
  };
}

// ── Mutations ──

/**
 * Create a new punch list item for a phase.
 * `itemNumber` is auto-assigned as `(current item count) + 1`.
 * New items start with status OPEN.
 *
 * Requires: can(role, "create", "phase") — CONTRACTOR and above.
 *
 * @param data.phaseId       - Phase the deficiency belongs to.
 * @param data.title         - Short description of the issue (trimmed).
 * @param data.description   - Detailed notes (optional, trimmed).
 * @param data.priority      - CRITICAL | HIGH | MEDIUM | LOW
 * @param data.location      - Location in the building (optional, trimmed).
 * @param data.assignedToId  - Staff ID responsible for resolution (optional).
 * @param data.dueDate       - ISO date string for resolution deadline (optional).
 * @returns The created PunchListItem record.
 */
export async function createPunchListItem(data: {
  phaseId: string;
  title: string;
  description?: string;
  priority: string;
  location?: string;
  assignedToId?: string;
  dueDate?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "create", "phase")) throw new Error("No permission");

  const dbc = db as any;

  // Sequential item number within the phase (not globally unique)
  const count = await dbc.punchListItem.count({ where: { phaseId: data.phaseId } });
  const itemNumber = count + 1;

  const item = await dbc.punchListItem.create({
    data: {
      phaseId: data.phaseId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      itemNumber,
      priority: data.priority,
      status: "OPEN",
      location: data.location?.trim() || null,
      assignedToId: data.assignedToId || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      createdById: session.user.id,
    },
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

/**
 * Update the status of a punch list item.
 * Automatically sets `closedAt` when transitioning to CLOSED status.
 *
 * Requires: can(role, "update", "phase") — CONTRACTOR and above.
 *
 * @param itemId - ID of the punch list item to update.
 * @param status - New status (OPEN | IN_PROGRESS | READY_FOR_REVIEW | CLOSED).
 * @returns The updated PunchListItem record.
 */
export async function updatePunchListStatus(itemId: string, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "phase")) throw new Error("No permission");

  const dbc = db as any;
  const updateData: any = { status };
  // Auto-timestamp closure — not set for other status transitions
  if (status === "CLOSED") {
    updateData.closedAt = new Date();
  }

  const item = await dbc.punchListItem.update({
    where: { id: itemId },
    data: updateData,
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

/**
 * Update editable fields on a punch list item (title, description, priority,
 * location, assignee, due date). Only includes fields present in `data`.
 *
 * Requires: can(role, "update", "phase") — CONTRACTOR and above.
 *
 * @param itemId - ID of the punch list item to update.
 * @param data   - Partial update object; only supplied fields are written.
 * @returns The updated PunchListItem record.
 */
export async function updatePunchListItem(
  itemId: string,
  data: {
    title?: string;
    description?: string;
    priority?: string;
    location?: string;
    assignedToId?: string | null;
    dueDate?: string | null;
  }
) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "phase")) throw new Error("No permission");

  const dbc = db as any;
  // Build the update payload — only include keys that were supplied
  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.description !== undefined) updateData.description = data.description?.trim() || null;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.location !== undefined) updateData.location = data.location?.trim() || null;
  if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId || null;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;

  const item = await dbc.punchListItem.update({
    where: { id: itemId },
    data: updateData,
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

/**
 * Permanently delete a punch list item.
 * Use for erroneous entries; completed items should typically be CLOSED, not deleted.
 *
 * Requires: can(role, "delete", "phase") — PROJECT_MANAGER and above.
 *
 * @param itemId - ID of the punch list item to delete.
 */
export async function deletePunchListItem(itemId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "delete", "phase")) throw new Error("No permission");

  const dbc = db as any;
  await dbc.punchListItem.delete({ where: { id: itemId } });

  revalidatePath(`/dashboard/projects`);
}
