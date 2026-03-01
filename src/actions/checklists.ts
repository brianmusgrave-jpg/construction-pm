"use server";

/**
 * @file actions/checklists.ts
 * @description Server actions for phase checklists — applying templates, toggling
 * items, adding custom items, and deleting items.
 *
 * Checklist model:
 *   Phase → (0 or 1) Checklist → ChecklistItem[]
 *   Each phase may have at most one checklist. A checklist is created by
 *   applying a ChecklistTemplate; items can then be customised per-phase.
 *
 * Completion notification:
 *   When `toggleChecklistItem` marks an item complete, the remaining-items count
 *   is checked. If the count drops to 0, all project members are notified via SSE
 *   with a CHECKLIST_COMPLETED notification.
 *
 * Custom items:
 *   `addCustomChecklistItem` appends ad-hoc items beyond what the template provided.
 *   New items get `order = maxOrder + 1` so they appear at the bottom of the list.
 *
 * Permission model (all ops use `can()` from @/lib/permissions):
 *   - applyChecklistTemplate:  can(role, "create", "checklist")
 *   - toggleChecklistItem:     can(role, "update", "checklist")
 *   - addCustomChecklistItem:  can(role, "create", "checklist")
 *   - deleteChecklistItem:     can(role, "delete", "checklist")
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { notify, getProjectMemberIds } from "@/lib/notifications";

// ── Template Application ──

/**
 * Apply a checklist template to a phase, creating a new Checklist with the
 * template's items copied in (at their original order).
 *
 * One checklist per phase: throws if the phase already has a checklist.
 * Items are copied by value — subsequent template edits do NOT affect
 * checklists that have already been applied to phases.
 *
 * @param phaseId    - Phase to apply the checklist to.
 * @param templateId - ChecklistTemplate to copy items from.
 * @returns The created Checklist record with phase info included.
 */
export async function applyChecklistTemplate(
  phaseId: string,
  templateId: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "create", "checklist"))
    throw new Error("Forbidden");

  // Enforce one-checklist-per-phase constraint
  const existing = await db.checklist.findUnique({ where: { phaseId } });
  if (existing) throw new Error("Phase already has a checklist");

  // Fetch the template to copy items from (items already ordered by `order` asc)
  const template = await db.checklistTemplate.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!template) throw new Error("Template not found");

  // Items are copied by value — template changes won't retroactively affect this checklist
  const checklist = await db.checklist.create({
    data: {
      phaseId,
      items: {
        create: template.items.map((item: { title: string; order: number }) => ({
          title: item.title,
          order: item.order,
        })),
      },
    },
    include: { phase: { select: { name: true, projectId: true } } },
  });

  // Activity log — fire-and-forget
  db.activityLog.create({
    data: {
      orgId: session.user.orgId!,
      action: "CHECKLIST_APPLIED",
      message: `Applied "${template.name}" checklist to ${checklist.phase.name}`,
      projectId: checklist.phase.projectId,
      userId: session.user.id,
      data: { phaseId, templateId, templateName: template.name },
    },
  }).catch(() => {});

  revalidatePath(`/dashboard/projects/${checklist.phase.projectId}`);
  return checklist;
}

// ── Item Toggling ──

/**
 * Toggle a checklist item's completion state.
 *
 * Stores `completedAt` and `completedById` when completing; clears them when
 * un-checking (these are used for the audit trail and undo system).
 *
 * Completion trigger:
 *   After a completing toggle, checks if ALL items in the checklist are now done.
 *   If so, sends a CHECKLIST_COMPLETED notification to all project members via SSE.
 *
 * The activity log entry includes `wasCompleted` (the state BEFORE this toggle),
 * which `undoActivity` in activity.ts uses to reverse the operation.
 *
 * @param itemId - ID of the ChecklistItem to toggle.
 * @returns The updated ChecklistItem record.
 */
export async function toggleChecklistItem(itemId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "update", "checklist"))
    throw new Error("Forbidden");

  const item = await db.checklistItem.findUnique({
    where: { id: itemId },
    include: {
      checklist: {
        include: { phase: { select: { projectId: true } } },
      },
    },
  });
  if (!item) throw new Error("Item not found");

  const nowCompleting = !item.completed; // Toggle direction

  const updated = await db.checklistItem.update({
    where: { id: itemId },
    data: {
      completed: nowCompleting,
      completedAt: nowCompleting ? new Date() : null,
      completedById: nowCompleting ? session.user.id : null,
    },
  });

  // Activity log — `wasCompleted` is the PRE-toggle state (used by undoActivity)
  db.activityLog.create({
    data: {
      orgId: session.user.orgId!,
      action: "CHECKLIST_ITEM_TOGGLED",
      message: `${nowCompleting ? "Completed" : "Unchecked"} "${item.title}"`,
      projectId: item.checklist.phase.projectId,
      userId: session.user.id,
      data: {
        phaseId: item.checklist.phaseId,
        itemId: itemId,
        completed: nowCompleting,
        wasCompleted: item.completed, // Pre-toggle state for undo
        completedById: item.completedById,
      },
    },
  }).catch(() => {});

  // Check if the checklist is now 100% complete (only when completing an item)
  if (nowCompleting) {
    const remaining = await db.checklistItem.count({
      where: { checklistId: item.checklist.id, completed: false },
    });
    if (remaining === 0) {
      // All items done — notify the whole project team
      const phase = await db.phase.findUnique({
        where: { id: item.checklist.phaseId },
        select: { id: true, name: true, projectId: true, project: { select: { name: true } } },
      });
      if (phase) {
        const memberIds = await getProjectMemberIds(phase.projectId);
        notify({
          type: "CHECKLIST_COMPLETED",
          title: `Checklist Complete: ${phase.name}`,
          message: `All checklist items completed for ${phase.name} on ${phase.project.name}`,
          recipientIds: memberIds,
          actorId: session.user.id,
          data: { projectId: phase.projectId, phaseId: phase.id },
        });
      }
    }
  }

  revalidatePath(`/dashboard/projects/${item.checklist.phase.projectId}`);
  return updated;
}

// ── Custom Item Management ──

/**
 * Add a custom (non-template) item to an existing checklist.
 * Appended at the end with `order = maxOrder + 1`.
 *
 * @param checklistId - Checklist to add the item to.
 * @param title       - Display text for the new item.
 * @returns The created ChecklistItem with its checklist/phase context included.
 */
export async function addCustomChecklistItem(
  checklistId: string,
  title: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "create", "checklist"))
    throw new Error("Forbidden");

  // Compute the next order value — append after the current last item
  const maxOrder = await db.checklistItem.aggregate({
    where: { checklistId },
    _max: { order: true },
  });

  const item = await db.checklistItem.create({
    data: {
      checklistId,
      title,
      // If checklist has no items yet, maxOrder._max.order is null → start at 0
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: {
      checklist: {
        include: { phase: { select: { projectId: true } } },
      },
    },
  });

  revalidatePath(`/dashboard/projects/${item.checklist.phase.projectId}`);
  return item;
}

/**
 * Delete a checklist item.
 * No re-ordering of remaining items is performed — gaps in `order` are acceptable
 * since items are displayed in ascending order and gaps don't affect sort behaviour.
 *
 * Requires: can(role, "delete", "checklist").
 *
 * @param itemId - ID of the ChecklistItem to delete.
 */
export async function deleteChecklistItem(itemId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "delete", "checklist"))
    throw new Error("Forbidden");

  const item = await db.checklistItem.delete({
    where: { id: itemId },
    include: {
      checklist: {
        include: { phase: { select: { projectId: true } } },
      },
    },
  });

  revalidatePath(`/dashboard/projects/${item.checklist.phase.projectId}`);
}
