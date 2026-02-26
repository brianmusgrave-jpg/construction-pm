"use server";

/**
 * @file actions/templates.ts
 * @description Server actions for checklist template management.
 *
 * Checklist templates are reusable phase inspection checklists that ADMIN and
 * PROJECT_MANAGER users define once in Settings and then apply to individual
 * phases when creating or editing them (see `src/actions/checklists.ts`).
 *
 * Template structure:
 *   ChecklistTemplate (name) → ChecklistTemplateItem[] (title, order)
 *
 * Update strategy:
 *   `updateChecklistTemplate` uses a delete-and-recreate approach for items
 *   rather than diffing the array. This is simpler and correct: templates are
 *   never referenced by item ID downstream, so there is no foreign key concern.
 *
 * All mutations require ADMIN or PROJECT_MANAGER role. Any authenticated user
 * may read templates (used when applying a template to a phase checklist).
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── Auth helper ──

/**
 * Assert ADMIN or PROJECT_MANAGER role.
 * Templates are a settings-level resource — CONTRACTOR and below cannot create
 * or modify them, only read them.
 */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role || "VIEWER";
  if (role !== "ADMIN" && role !== "PROJECT_MANAGER") {
    throw new Error("Only admins and PMs can manage templates");
  }
  return session;
}

// ── Queries ──

/**
 * Fetch all checklist templates with their ordered items.
 * Available to any authenticated user so templates can be displayed in the
 * phase checklist picker regardless of role.
 *
 * Items are returned in ascending `order` — the order they were saved in the
 * template editor.
 */
export async function getChecklistTemplates() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return db.checklistTemplate.findMany({
    include: {
      items: { orderBy: { order: "asc" } },
    },
    orderBy: { name: "asc" },
  });
}

// ── Mutations ──

/**
 * Create a new checklist template with a set of items.
 * Items are stored with an `order` index that mirrors the input array order.
 * Blank item strings are filtered out before saving.
 *
 * @param data.name  - Display name for the template (must be non-empty).
 * @param data.items - Ordered list of item title strings (at least one required).
 * @returns The created template with its items included.
 */
export async function createChecklistTemplate(data: {
  name: string;
  items: string[];
}) {
  await requireAdmin();

  if (!data.name.trim()) throw new Error("Template name is required");
  if (data.items.length === 0) throw new Error("At least one item is required");

  const template = await db.checklistTemplate.create({
    data: {
      name: data.name.trim(),
      items: {
        create: data.items
          .filter((t) => t.trim()) // Drop blank lines from the editor
          .map((title, i) => ({ title: title.trim(), order: i })),
      },
    },
    include: { items: { orderBy: { order: "asc" } } },
  });

  revalidatePath("/dashboard/settings");
  return template;
}

/**
 * Replace a template's name and items with new values.
 *
 * Item update strategy: delete all existing items then insert the new set.
 * This avoids diffing complexity — template items have no downstream FKs that
 * would be broken by deletion (applied checklists copy the items at apply time).
 *
 * @param templateId - ID of the template to update.
 * @param data.name  - New display name (must be non-empty).
 * @param data.items - New ordered item list (at least one required).
 * @returns The updated template with its new items included.
 */
export async function updateChecklistTemplate(
  templateId: string,
  data: { name: string; items: string[] }
) {
  await requireAdmin();

  if (!data.name.trim()) throw new Error("Template name is required");
  if (data.items.length === 0) throw new Error("At least one item is required");

  // Delete all existing items first, then recreate from the new array.
  // Simpler and safer than diffing — no downstream FK references to items.
  await db.checklistTemplateItem.deleteMany({
    where: { templateId },
  });

  const template = await db.checklistTemplate.update({
    where: { id: templateId },
    data: {
      name: data.name.trim(),
      items: {
        create: data.items
          .filter((t) => t.trim())
          .map((title, i) => ({ title: title.trim(), order: i })),
      },
    },
    include: { items: { orderBy: { order: "asc" } } },
  });

  revalidatePath("/dashboard/settings");
  return template;
}

/**
 * Permanently delete a checklist template and all its items (cascade).
 * This does NOT affect checklists that were already applied to phases — those
 * are independent rows in the Checklist/ChecklistItem tables.
 */
export async function deleteChecklistTemplate(templateId: string) {
  await requireAdmin();

  await db.checklistTemplate.delete({
    where: { id: templateId },
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}
