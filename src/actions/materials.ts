"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";
import type { Material, MaterialStatus } from "@/lib/db-types";

async function requireMember(phaseId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  const phase = await (db as any).phase.findUnique({
    where: { id: phaseId },
    include: { project: { include: { members: { where: { userId: session.user.id } } } } },
  });
  if (!phase) throw new Error("Phase not found");
  const member = phase.project.members[0];
  if (!member) throw new Error("Not a project member");
  return { userId: session.user.id, member, projectId: phase.projectId };
}

export async function getMaterials(phaseId: string): Promise<Material[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const mats = await db.material.findMany({
    where: { phaseId },
    orderBy: { createdAt: "asc" },
  });
  return mats.map((m: any) => ({ ...m, cost: m.cost ? Number(m.cost) : null }));
}

export async function createMaterial(data: {
  phaseId: string;
  name: string;
  quantity: number;
  unit: string;
  cost?: number;
  supplier?: string;
  notes?: string;
}): Promise<void> {
  const { projectId } = await requireMember(data.phaseId);
  await db.material.create({
    data: {
      phaseId: data.phaseId,
      name: data.name,
      quantity: data.quantity,
      unit: data.unit,
      cost: data.cost ?? null,
      supplier: data.supplier ?? null,
      notes: data.notes ?? null,
      status: "ORDERED",
    },
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function updateMaterialStatus(
  materialId: string,
  status: MaterialStatus
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  const mat = await db.material.findUnique({
    where: { id: materialId },
    include: { phase: { include: { project: { include: { members: { where: { userId: session.user.id } } } } } } },
  });
  if (!mat) throw new Error("Material not found");
  if (!mat.phase.project.members[0]) throw new Error("Not a project member");

  const now = new Date();
  await db.material.update({
    where: { id: materialId },
    data: {
      status,
      deliveredAt: status === "DELIVERED" ? now : mat.deliveredAt,
      installedAt: status === "INSTALLED" ? now : mat.installedAt,
    },
  });
  revalidatePath(`/dashboard/projects/${mat.phase.projectId}`);
}

export async function deleteMaterial(materialId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  const mat = await db.material.findUnique({
    where: { id: materialId },
    include: { phase: { include: { project: { include: { members: { where: { userId: session.user.id } } } } } } },
  });
  if (!mat) throw new Error("Material not found");
  const member = mat.phase.project.members[0];
  if (!member || !["PM", "ADMIN"].includes(member.role)) throw new Error("Insufficient permissions");

  await db.material.delete({ where: { id: materialId } });
  revalidatePath(`/dashboard/projects/${mat.phase.projectId}`);
}
