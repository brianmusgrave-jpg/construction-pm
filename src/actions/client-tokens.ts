"use server";

/**
 * @file actions/client-tokens.ts
 * @description Server actions for client portal access token management.
 *
 * Client tokens give external clients read-only access to a project's portal
 * page without requiring a full Construction PM account. Tokens are:
 *   - 24-byte random hex strings (48 chars) generated with `crypto.randomBytes`.
 *   - Stored as SHA-256 hashes only — the raw token is returned ONCE at creation
 *     and never stored in plaintext (mirrors the api-keys.ts pattern).
 *   - Optionally expirable via an `expiresAt` timestamp.
 *   - Soft-revokable (`active: false`) without deletion, or hard-deletable.
 *
 * Permission model: project-scoped. All write operations require the caller
 * to be a ProjectMember with role "PM" or "ADMIN" — not the global User.role.
 * Read operations (`getClientTokens`) require any project membership.
 *
 * `verifyClientToken` is called by the client portal route to authenticate
 * an incoming raw token from a URL parameter or cookie.
 *
 * Models used: ClientToken (in generated Prisma types via @/lib/db-types);
 * ProjectMember (cast via `db as any` — not in generated types).
 */

import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db-types";
import type { ClientToken } from "@/lib/db-types";
import { z } from "zod";

// ── Zod Schema ──

/** Validates the input for token creation. */
const CreateTokenSchema = z.object({
  projectId: z.string().min(1),
  label: z.string().min(1).max(200),
  expiresAt: z.string().optional(), // ISO date string; omit for non-expiring tokens
});

// ── Helpers ──

/**
 * Hash a raw token for safe storage.
 * SHA-256 is used for one-way hashing — the hash is what gets persisted,
 * never the plaintext token value.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Assert the caller is a PM or ADMIN on the given project.
 * Checks ProjectMember.role (project-scoped), not the global User.role.
 *
 * @throws "Unauthenticated" if no session.
 * @throws "Insufficient permissions" if not a PM/ADMIN member.
 * @returns The session user ID on success.
 */
async function requirePM(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  // ProjectMember is not in the generated Prisma types; cast required.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const member = await (db as any).projectMember.findFirst({
    where: { projectId, userId: session.user.id, role: { in: ["PM", "ADMIN"] } },
  });
  if (!member) throw new Error("Insufficient permissions");
  return session;
}

// ── Queries ──

/**
 * List all client tokens for a project.
 * Returns an empty array for unauthenticated callers or non-members (safe
 * for server components) — does NOT throw.
 *
 * @param projectId - The project whose tokens to list.
 * @returns Tokens ordered newest-first, with hashed `token` field (not raw).
 */
export async function getClientTokens(projectId: string): Promise<ClientToken[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  // Any project member can view the token list (revoke/delete require PM).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const member = await (db as any).projectMember.findFirst({
    where: { projectId, userId: session.user.id },
  });
  if (!member) return [];
  return db.clientToken.findMany({ where: { orgId: session.user.orgId!, projectId }, orderBy: { createdAt: "desc" } });
}

// ── Mutations ──

/**
 * Create a new client portal access token for a project.
 *
 * Generates a 24-byte random hex token (48 chars), stores its SHA-256 hash,
 * and returns the plaintext token ONCE in the response. The caller MUST
 * present this value to the user immediately — it cannot be recovered later.
 *
 * @param data.projectId - Project the token grants access to.
 * @param data.label     - Human-readable name (e.g. "Client Review Link").
 * @param data.expiresAt - Optional ISO date string for token expiry.
 * @returns The created token record with an additional `rawToken` field.
 *
 * Requires: PM or ADMIN project membership.
 */
export async function createClientToken(data: {
  projectId: string;
  label: string;
  expiresAt?: string;
}): Promise<ClientToken & { rawToken?: string }> {
  const validated = CreateTokenSchema.parse(data);
  const session = await requirePM(validated.projectId);

  // 24 bytes = 48-char hex string (vs 32 bytes / 64 chars for API keys)
  const rawToken = randomBytes(24).toString("hex");
  const tokenHashed = hashToken(rawToken);

  const ct = await db.clientToken.create({
    data: {
      orgId: session.user.orgId!,
      token: tokenHashed,       // Only the hash is persisted
      label: validated.label,
      projectId: validated.projectId,
      expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
      active: true,
    },
  });

  revalidatePath(`/dashboard/projects/${validated.projectId}`);
  // Attach the raw token to the response so the caller can display it once.
  // It will NOT be available from any future API call.
  return { ...ct, rawToken };
}

/**
 * Soft-revoke a client token by setting `active: false`.
 * The record is retained for audit purposes; use `deleteClientToken` for
 * hard deletion.
 *
 * @param tokenId   - ID of the ClientToken to revoke.
 * @param projectId - Project the token belongs to (used for permission check).
 *
 * Requires: PM or ADMIN project membership.
 */
export async function revokeClientToken(tokenId: string, projectId: string): Promise<void> {
  await requirePM(projectId);
  await db.clientToken.update({ where: { id: tokenId }, data: { active: false } });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

/**
 * Permanently delete a client token record.
 * Prefer `revokeClientToken` for deactivation with audit trail retention.
 *
 * @param tokenId   - ID of the ClientToken to delete.
 * @param projectId - Project the token belongs to (used for permission check).
 *
 * Requires: PM or ADMIN project membership.
 */
export async function deleteClientToken(tokenId: string, projectId: string): Promise<void> {
  await requirePM(projectId);
  await db.clientToken.delete({ where: { id: tokenId } });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

/**
 * Verify a raw client token from the portal route.
 *
 * Hashes the incoming raw token and looks up the hash. Returns null (not a
 * throw) when the token is unknown, revoked, or expired so the portal page
 * can render an appropriate "access denied" state.
 *
 * @param rawToken - The plaintext token from the URL parameter or cookie.
 * @returns The matching ClientToken record, or null if invalid/expired.
 */
export async function verifyClientToken(rawToken: string) {
  const tokenHashed = hashToken(rawToken);
  const ct = await db.clientToken.findFirst({ where: { token: tokenHashed, active: true } });
  if (!ct) return null;
  // Reject expired tokens; token is otherwise valid
  if (ct.expiresAt && new Date(ct.expiresAt) < new Date()) return null;
  return ct;
}
