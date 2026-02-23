"use server";

import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";
import type { ClientToken } from "@/lib/db-types";
import { z } from "zod";

const CreateTokenSchema = z.object({
  projectId: z.string().min(1),
  label: z.string().min(1).max(200),
  expiresAt: z.string().optional(),
});

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function requirePM(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const member = await (db as any).projectMember.findFirst({
    where: { projectId, userId: session.user.id, role: { in: ["PM", "ADMIN"] } },
  });
  if (!member) throw new Error("Insufficient permissions");
  return session.user.id;
}

export async function getClientTokens(projectId: string): Promise<ClientToken[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
}): Promise<ClientToken & { rawToken?: string }> {
  const validated = CreateTokenSchema.parse(data);
  await requirePM(validated.projectId);
  const rawToken = randomBytes(24).toString("hex");
  const tokenHashed = hashToken(rawToken);
  const ct = await db.clientToken.create({
    data: {
      token: tokenHashed,
      label: validated.label,
      projectId: validated.projectId,
      expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
      active: true,
    },
  });
  revalidatePath(`/dashboard/projects/${validated.projectId}`);
  // Return the raw token once so the user can copy it; it's never stored in plaintext
  return { ...ct, rawToken };
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

/**
 * Verify a client token by hashing the incoming raw token and looking up the hash.
 * Used by the client portal page.
 */
export async function verifyClientToken(rawToken: string) {
  const tokenHashed = hashToken(rawToken);
  const ct = await db.clientToken.findFirst({ where: { token: tokenHashed, active: true } });
  if (!ct) return null;
  if (ct.expiresAt && new Date(ct.expiresAt) < new Date()) return null;
  return ct;
}
