"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";
import type { ApiKey } from "@/lib/db-types";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  return session.user.id;
}

export async function getApiKeys(): Promise<ApiKey[]> {
  await requireAuth();
  return db.apiKey.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createApiKey(name: string, expiresAt?: string): Promise<{ key: string; id: string }> {
  await requireAuth();
  if (!name.trim()) throw new Error("Name is required");

  // Generate key: cpk_ prefix + 64 hex chars
  const rawKey = randomBytes(32).toString("hex");
  const fullKey = "cpk_" + rawKey;
  const keyHash = createHash("sha256").update(fullKey).digest("hex");
  // Store only a safe display hint — last 4 chars, no key material exposed
  const prefix = "cpk_..." + rawKey.slice(-4);

  const record = await db.apiKey.create({
    data: {
      name: name.trim(),
      keyHash,
      prefix,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      active: true,
    },
  });

  revalidatePath("/dashboard/settings");
  return { key: fullKey, id: record.id };
}

export async function revokeApiKey(id: string): Promise<void> {
  await requireAuth();
  await db.apiKey.update({ where: { id }, data: { active: false } });
  revalidatePath("/dashboard/settings");
}

export async function deleteApiKey(id: string): Promise<void> {
  await requireAuth();
  await db.apiKey.delete({ where: { id } });
  revalidatePath("/dashboard/settings");
}

// Middleware helper — verify an incoming API key from Authorization header
export async function verifyApiKey(rawKey: string): Promise<boolean> {
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const record = await db.apiKey.findUnique({ where: { keyHash } });
  if (!record || !record.active) return false;
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) return false;
  // Update lastUsedAt (fire-and-forget)
  db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return true;
}
