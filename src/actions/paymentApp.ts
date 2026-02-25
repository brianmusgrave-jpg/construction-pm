"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

const dbc = db as any;

export async function getPaymentApplications(phaseId: string) {
  try {
    const apps = await dbc.paymentApplication.findMany({
      where: { phaseId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { number: "desc" },
    });
    return apps.map((a: any) => ({
      ...a,
      scheduledValue: a.scheduledValue ? Number(a.scheduledValue) : 0,
      workCompleted: a.workCompleted ? Number(a.workCompleted) : 0,
      materialsStored: a.materialsStored ? Number(a.materialsStored) : 0,
      retainage: a.retainage ? Number(a.retainage) : 0,
      previousPayments: a.previousPayments ? Number(a.previousPayments) : 0,
      currentDue: a.currentDue ? Number(a.currentDue) : 0,
    }));
  } catch {
    return [];
  }
}

export async function createPaymentApplication(data: {
  phaseId: string;
  periodStart: string;
  periodEnd: string;
  scheduledValue: number;
  workCompleted: number;
  materialsStored?: number;
  retainage?: number;
  previousPayments?: number;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "phase")) throw new Error("Forbidden");

  // Get next number
  const last = await dbc.paymentApplication.findFirst({
    where: { phaseId: data.phaseId },
    orderBy: { number: "desc" },
    select: { number: true },
  }).catch(() => null);
  const nextNumber = (last?.number || 0) + 1;

  const currentDue = data.workCompleted + (data.materialsStored || 0) - (data.retainage || 0) - (data.previousPayments || 0);

  const app = await dbc.paymentApplication.create({
    data: {
      phaseId: data.phaseId,
      number: nextNumber,
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      scheduledValue: data.scheduledValue,
      workCompleted: data.workCompleted,
      materialsStored: data.materialsStored || 0,
      retainage: data.retainage || 0,
      previousPayments: data.previousPayments || 0,
      currentDue,
      notes: data.notes || null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/dashboard");
  return { ...app, scheduledValue: Number(app.scheduledValue), workCompleted: Number(app.workCompleted), materialsStored: Number(app.materialsStored), retainage: Number(app.retainage), previousPayments: Number(app.previousPayments), currentDue: Number(app.currentDue) };
}

export async function updatePaymentAppStatus(id: string, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden");

  await dbc.paymentApplication.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/dashboard");
}

export async function deletePaymentApplication(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden");

  await dbc.paymentApplication.delete({ where: { id } });
  revalidatePath("/dashboard");
}
