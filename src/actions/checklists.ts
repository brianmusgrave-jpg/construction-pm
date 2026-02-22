"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function applyChecklistTemplate(
  phaseId: string,
  templateId: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "create", "checklist"))
    throw new Error("Forbidden");

  // Check if phase already has a checklist
  const existing = await db.checklist.findUnique({
    where: { phaseId },
  });
  if (existing) throw new Error("Phase already has a checklist");

  // Get template items
  const template = await db.checklistTemplate.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!template) throw new Error("Template not found");

  // Create checklist with items from template
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
    include: { phase: { select: { projectId: true } } },
  });

  revalidatePath(`/dashboard/projects/${checklist.phase.projectId}`);
  return checklist;
}

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

  const updated = await db.checklistItem.update({
    where: { id: itemId },
    data: {
      completed: !item.completed,
      completedAt: !item.completed ? new Date() : null,
      completedById: !item.completed ? session.user.id : null,
    },
  });

  revalidatePath(
    `/dashboard/projects/${item.checklist.phase.projectId}`
  );
  return updated;
}

export async function addCustomChecklistItem(
  checklistId: string,
  title: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!can(session.user.role || "VIEWER", "create", "checklist"))
    throw new Error("Forbidden");

  // Get next order
  const maxOrder = await db.checklistItem.aggregate({
    where: { checklistId },
    _max: { order: true },
  });

  const item = await db.checklistItem.create({
    data: {
      checklistId,
      title,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: {
      checklist: {
        include: { phase: { select: { projectId: true } } },
      },
    },
  });

  revalidatePath(
    `/dashboard/projects/${item.checklist.phase.projectId}`
  );
  return item;
}

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

  revalidatePath(
    `/dashboard/projects/${item.checklist.phase.projectId}`
  );
}
