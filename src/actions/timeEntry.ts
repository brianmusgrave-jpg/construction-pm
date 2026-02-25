"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// ── Get Time Entries ──
export async function getTimeEntries(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  const dbc = db as any;
  const items = await dbc.timeEntry.findMany({
    where: { phaseId },
    include: {
      worker: { select: { id: true, name: true, company: true, role: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return items.map((item: any) => ({
    ...item,
    date: item.date?.toISOString?.() ?? item.date,
    createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
    approvedAt: item.approvedAt?.toISOString?.() ?? item.approvedAt,
  }));
}

// ── Create Time Entry ──
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
      status: "PENDING",
      createdById: session.user.id,
    },
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

// ── Approve Time Entry ──
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

// ── Reject Time Entry ──
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

// ── Delete Time Entry ──
export async function deleteTimeEntry(entryId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "delete", "phase")) throw new Error("No permission");

  const dbc = db as any;
  await dbc.timeEntry.delete({ where: { id: entryId } });
  revalidatePath(`/dashboard/projects`);
}

// ── Get Time Summary ──
export async function getTimeSummary(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");

  const dbc = db as any;
  const entries = await dbc.timeEntry.findMany({
    where: { phaseId },
    select: { hours: true, status: true, costCode: true },
  });

  const totalHours = entries.reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
  const approvedHours = entries.filter((e: any) => e.status === "APPROVED").reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
  const pendingHours = entries.filter((e: any) => e.status === "PENDING").reduce((sum: number, e: any) => sum + (e.hours || 0), 0);

  return { totalHours, approvedHours, pendingHours, entryCount: entries.length };
}
