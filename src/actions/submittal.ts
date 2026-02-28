"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

// ── Get Submittals ──
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

  return items.map((item: any) => ({
    ...item,
    createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
    dueDate: item.dueDate?.toISOString?.() ?? item.dueDate,
    returnedAt: item.returnedAt?.toISOString?.() ?? item.returnedAt,
  }));
}

// ── Create Submittal ──
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
      revision: 0,
      assignedToId: data.assignedToId || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      submittedById: session.user.id,
    },
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

// ── Update Submittal Status ──
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

// ── Revise Submittal (bump revision) ──
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
      returnedAt: null,
    },
  });

  revalidatePath(`/dashboard/projects`);
  return item;
}

// ── Delete Submittal ──
export async function deleteSubmittal(submittalId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "delete", "phase")) throw new Error("No permission");

  const dbc = db as any;
  await dbc.submittal.delete({ where: { id: submittalId } });
  revalidatePath(`/dashboard/projects`);
}
