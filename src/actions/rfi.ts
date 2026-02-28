"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// ── Get RFIs ──
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

  return items.map((item: any) => ({
    ...item,
    createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
    dueDate: item.dueDate?.toISOString?.() ?? item.dueDate,
    answeredAt: item.answeredAt?.toISOString?.() ?? item.answeredAt,
    closedAt: item.closedAt?.toISOString?.() ?? item.closedAt,
  }));
}

// ── Create RFI ──
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

// ── Answer RFI ──
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

// ── Update RFI Status ──
export async function updateRFIStatus(rfiId: string, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "phase")) throw new Error("No permission");

  const dbc = db as any;
  const updateData: any = { status };
  if (status === "CLOSED") updateData.closedAt = new Date();

  const item = await dbc.rFI.update({
    where: { id: rfiId },
    data: updateData,
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

// ── Delete RFI ──
export async function deleteRFI(rfiId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "delete", "phase")) throw new Error("No permission");

  const dbc = db as any;
  await dbc.rFI.delete({ where: { id: rfiId } });
  revalidatePath(`/dashboard/projects`);
}
