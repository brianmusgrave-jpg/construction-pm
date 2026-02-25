"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

const dbc = db as any;

export async function getEstimates(phaseId: string) {
  return dbc.estimate
    .findMany({
      where: { phaseId },
      include: {
        createdBy: { select: { id: true, name: true } },
        items: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    })
    .then((ests: any[]) =>
      ests.map((e: any) => ({
        ...e,
        totalCost: Number(e.totalCost),
        items: e.items.map((i: any) => ({
          ...i,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
          totalCost: Number(i.totalCost),
        })),
      }))
    )
    .catch(() => []);
}

export async function createEstimate(data: {
  phaseId: string;
  name: string;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "create", "document")) throw new Error("Forbidden");

  const estimate = await dbc.estimate.create({
    data: {
      name: data.name,
      description: data.description,
      phaseId: data.phaseId,
      createdById: session.user.id,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      items: true,
    },
  });

  revalidatePath(`/dashboard/projects`);
  return { ...estimate, totalCost: Number(estimate.totalCost), items: [] };
}

export async function addTakeoffItem(data: {
  estimateId: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  category?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "create", "document")) throw new Error("Forbidden");

  const totalCost = data.quantity * data.unitCost;

  const item = await dbc.takeoffItem.create({
    data: {
      description: data.description,
      quantity: data.quantity,
      unit: data.unit,
      unitCost: data.unitCost,
      totalCost,
      category: data.category,
      notes: data.notes,
      estimateId: data.estimateId,
    },
  });

  // Recalculate estimate total
  const allItems = await dbc.takeoffItem.findMany({ where: { estimateId: data.estimateId } });
  const newTotal = allItems.reduce((sum: number, i: any) => sum + Number(i.totalCost), 0);
  await dbc.estimate.update({ where: { id: data.estimateId }, data: { totalCost: newTotal } });

  revalidatePath(`/dashboard/projects`);
  return { ...item, quantity: Number(item.quantity), unitCost: Number(item.unitCost), totalCost: Number(item.totalCost) };
}

export async function deleteTakeoffItem(id: string, estimateId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "delete", "document")) throw new Error("Forbidden");

  await dbc.takeoffItem.delete({ where: { id } });

  const allItems = await dbc.takeoffItem.findMany({ where: { estimateId } });
  const newTotal = allItems.reduce((sum: number, i: any) => sum + Number(i.totalCost), 0);
  await dbc.estimate.update({ where: { id: estimateId }, data: { totalCost: newTotal } });

  revalidatePath(`/dashboard/projects`);
}

export async function updateEstimateStatus(id: string, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "document")) throw new Error("Forbidden");

  await dbc.estimate.update({ where: { id }, data: { status } });
  revalidatePath(`/dashboard/projects`);
}

export async function deleteEstimate(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "delete", "document")) throw new Error("Forbidden");

  await dbc.estimate.delete({ where: { id } });
  revalidatePath(`/dashboard/projects`);
}
