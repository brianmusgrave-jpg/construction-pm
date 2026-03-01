"use server";

/**
 * @file actions/api-keys.ts
 * @description Server actions for machine-to-machine API key management.
 *
 * API keys allow external systems (e.g. ERP integrations, CI scripts) to call
 * Construction PM's REST API without browser-based session cookies. Keys are
 * prefixed with `cpk_` for easy identification in logs and secret scanners.
 *
 * Security model:
 *   - The raw key is generated once and returned to the caller at creation time.
 *   - ONLY the SHA-256 hash of the full key is stored in the DB — the plaintext
 *     is never persisted. If a key is lost, it must be rotated (delete + recreate).
 *   - A safe display hint (last 4 chars) is stored as `prefix` for the UI.
 *   - Expiry is optional; expired keys are rejected by `verifyApiKey` without
 *     being hard-deleted, so they remain auditable.
 *
 * Middleware usage:
 *   `verifyApiKey(rawKey)` is called from the API route middleware. It is exported
 *   from this action file for co-location but is NOT a user-facing action — it
 *   takes the raw key string directly from the Authorization header.
 */

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";
import type { ApiKey } from "@/lib/db-types";

// ── Auth helper ──

/**
 * Asserts an active session and returns the user ID.
 * All actions in this file require authentication (no additional role check —
 * any authenticated user may manage their own API keys).
 */
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  return session;
}

// ── Queries ──

/**
 * List all API keys, ordered newest first.
 * Returns full records — note that `keyHash` is included but never shown in the
 * UI; the `prefix` field (e.g. "cpk_...a3f9") is used for display instead.
 */
export async function getApiKeys(): Promise<ApiKey[]> {
  const session = await requireAuth();
  return db.apiKey.findMany({
    where: { orgId: session.user.orgId! }, orderBy: { createdAt: "desc" } });
}

// ── Mutations ──

/**
 * Generate a new API key with the given display name and optional expiry.
 *
 * Key generation flow:
 *   1. `randomBytes(32)` → 64 hex chars (256 bits of entropy)
 *   2. Prepend `cpk_` → full key returned to caller
 *   3. SHA-256 hash of the full key stored in DB as `keyHash`
 *   4. Last 4 chars of the random portion stored as `prefix` for UI display
 *
 * @returns `{ key, id }` — `key` is the plaintext; show it once and discard.
 *   The caller is responsible for presenting it to the user before navigating away.
 */
export async function createApiKey(name: string, expiresAt?: string): Promise<{ key: string; id: string }> {
  const session = await requireAuth();
  if (!name.trim()) throw new Error("Name is required");

  // Generate key: cpk_ prefix + 64 hex chars (32 random bytes)
  const rawKey = randomBytes(32).toString("hex");
  const fullKey = "cpk_" + rawKey;
  const keyHash = createHash("sha256").update(fullKey).digest("hex");
  // Store only a safe display hint — last 4 chars of the random suffix
  // Never expose the full key or hash in the UI
  const prefix = "cpk_..." + rawKey.slice(-4);

  const record = await db.apiKey.create({
    data: {
      orgId: session.user.orgId!,
      name: name.trim(),
      keyHash,
      prefix,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      active: true,
    },
  });

  revalidatePath("/dashboard/settings");
  // Return the full plaintext key — this is the ONLY time it is available
  return { key: fullKey, id: record.id };
}

/**
 * Soft-revoke a key by setting `active = false`.
 * Prefer this over `deleteApiKey` so the key remains auditable in logs.
 */
export async function revokeApiKey(id: string): Promise<void> {
  await requireAuth();
  await db.apiKey.update({ where: { id }, data: { active: false } });
  revalidatePath("/dashboard/settings");
}

/**
 * Permanently delete a key record. Use when the key is no longer needed for
 * audit purposes. For temporary suspension, prefer `revokeApiKey` instead.
 */
export async function deleteApiKey(id: string): Promise<void> {
  await requireAuth();
  await db.apiKey.delete({ where: { id } });
  revalidatePath("/dashboard/settings");
}

// ── Middleware helper ──

/**
 * Verify an incoming raw API key from the `Authorization: Bearer cpk_...` header.
 * Called by API route middleware — NOT a user-facing action.
 *
 * Verification flow:
 *   1. Hash the incoming key with SHA-256
 *   2. Look up the hash in the DB (hash is unique index)
 *   3. Reject if: not found, inactive, or expired
 *   4. Fire-and-forget update of `lastUsedAt` for activity tracking
 *
 * @param rawKey - The full plaintext key as received in the Authorization header.
 * @returns `true` if the key is valid, active, and unexpired; `false` otherwise.
 */
export async function verifyApiKey(rawKey: string): Promise<boolean> {
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const record = await db.apiKey.findUnique({ where: { keyHash } });
  if (!record || !record.active) return false;
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) return false;
  // Update lastUsedAt — fire-and-forget; never block the request on this write
  db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return true;
}
