"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";
import type { ClientToken } from "@/lib/db-types";

async function requirePM(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  const member = await (db as any).projectMember.findFirst({
    where: { projectId, userId: session.user.id, role: { in: ["PM", "ADMIN"] } },
  });
  if (!member) throw new Error("Insufficient permissions");
  return session.user.id;
}

export async function getClientTokens(projectId: string): Promise<ClientToken[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const member = await (db as any).projectMember.findFirst({
    where: { projectId, userId: session.user.id },
  });
  if (!member) return [];
  return db.clientToken.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
}

export async function createClientToken(data: {
  projectId: string;
  label: string;
  expiresAt?: string;
}): Promise<ClientToken> {
  await requirePM(data.projectId);
  const token = randomBytes(24).toString("hex");
  const ct = await db.clientToken.create({
    data: {
      token,
      label: data.label,
      projectId: data.projectId,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      active: true,
    },
  });
  revalidatePath(`/dashboard/projects/${data.projectId}`);
  return ct;
}

export async function revokeClientToken(tokenId: string, projectId: string): Promise<void> {
  await requirePM(projectId);
  await db.clientToken.update({ where: { id: tokenId }, data: { active: false } });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function deleteClientToken(tokenId: string, projectId: string): Promise<void> {
  await requirePM(projectId);
  await db.clientToken.delete({ where: { id: tokenId } });
  revalidatePath(`/dashboard/projects/${projectId}`);
}
