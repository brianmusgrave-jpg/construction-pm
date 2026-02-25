"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// ── Get Punch List Items ──
export async function getPunchListItems(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  const dbc = db as any;
  const items = await dbc.punchListItem.findMany({
    where: { phaseId },
    include: {
      assignedTo: { select: { id: true, name: true, company: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
  });

  return items.map((item: any) => ({
    ...item,
    createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
    dueDate: item.dueDate?.toISOString?.() ?? item.dueDate,
    closedAt: item.closedAt?.toISOString?.() ?? item.closedAt,
  }));
}

// ── Create Punch List Item ──
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

  // Auto-generate item number
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

// ── Update Punch List Item Status ──
export async function updatePunchListStatus(
  itemId: string,
  status: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "phase")) throw new Error("No permission");

  const dbc = db as any;
  const updateData: any = { status };
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

// ── Update Punch List Item ──
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

// ── Delete Punch List Item ──
export async function deletePunchListItem(itemId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "delete", "phase")) throw new Error("No permission");

  const dbc = db as any;
  await dbc.punchListItem.delete({ where: { id: itemId } });

  revalidatePath(`/dashboard/projects`);
}

// ── Get Punch List Summary (for dashboard) ──
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
    critical: items.filter((i: any) => i.priority === "CRITICAL" && i.status !== "CLOSED").length,
  };
}
