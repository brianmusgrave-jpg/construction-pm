"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

const dbc = db as any;

export async function getLienWaivers(phaseId: string) {
  try {
    return await dbc.lienWaiver.findMany({
      where: { phaseId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export async function createLienWaiver(data: {
  phaseId: string;
  waiverType: string;
  vendorName: string;
  amount?: number;
  throughDate?: string;
  description?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "phase")) throw new Error("Forbidden");

  const waiver = await dbc.lienWaiver.create({
    data: {
      phaseId: data.phaseId,
      waiverType: data.waiverType,
      vendorName: data.vendorName,
      amount: data.amount || null,
      throughDate: data.throughDate ? new Date(data.throughDate) : null,
      description: data.description || null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/dashboard");
  return waiver;
}

export async function updateLienWaiverStatus(id: string, status: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "manage", "phase")) throw new Error("Forbidden");

  await dbc.lienWaiver.update({
    where: { id },
    data: { status, ...(status === "APPROVED" ? { notarized: true } : {}) },
  });

  revalidatePath("/dashboard");
}

export async function deleteLienWaiver(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as any).role || "VIEWER";
  if (!can(role, "update", "phase")) throw new Error("Forbidden");

  await dbc.lienWaiver.delete({ where: { id } });
  revalidatePath("/dashboard");
}
