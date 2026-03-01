"use server";

/**
 * @file actions/profile.ts
 * @description Server actions for user profile management (name, phone, company).
 *
 * Profile updates are self-service — any authenticated user may edit their own
 * profile; no elevated role is required.
 *
 * Change diffing:
 *   `updateProfile` computes a field-level diff before writing. If nothing has
 *   changed, the DB write is skipped entirely and `{ changed: false }` is returned.
 *   This prevents spurious activity log entries from no-op saves (e.g. user
 *   opens the profile page and clicks Save without changing anything).
 *
 * Activity log fan-out:
 *   When a profile IS changed, a MEMBER_UPDATED log entry is written to every
 *   project the user belongs to via `createMany`. This allows project activity
 *   feeds to surface "Alice updated her profile" without polling the users table.
 *
 * Note: Avatar/image upload is handled separately by the auth provider (not here).
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── Queries ──

/**
 * Fetch the current user's public profile fields.
 * Returns a minimal projection — image is included for avatar display only;
 * sensitive auth fields (password hash, tokens) are never selected.
 */
export async function getProfile() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true, company: true, image: true },
  });
  if (!user) throw new Error("User not found");
  return user;
}

// ── Mutations ──

/**
 * Update the current user's editable profile fields (name, phone, company).
 *
 * Fields omitted from `data` are left unchanged — partial updates are safe.
 * Fields set to `undefined` in the input are also treated as "no change".
 *
 * If nothing changed, returns early with `{ changed: false }` and skips all
 * DB writes and revalidation — keeps the activity log clean.
 *
 * On change, fans out a MEMBER_UPDATED activity entry to all projects the
 * user belongs to using `createMany` (single round-trip regardless of project count).
 *
 * @returns `{ changed: false }` if no fields differed from current values,
 *          `{ changed: true, changes }` where `changes` maps field names to
 *          `{ from, to }` pairs describing what was modified.
 */
export async function updateProfile(data: {
  name?: string;
  phone?: string;
  company?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Fetch current values to diff against
  const current = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, phone: true, company: true },
  });
  if (!current) throw new Error("User not found");

  // Build field-level change log — only include fields that actually differ
  const changes: Record<string, { from: string | null; to: string | null }> = {};
  if (data.name !== undefined && data.name !== current.name) {
    changes.name = { from: current.name, to: data.name };
  }
  if (data.phone !== undefined && data.phone !== current.phone) {
    changes.phone = { from: current.phone, to: data.phone };
  }
  if (data.company !== undefined && data.company !== current.company) {
    changes.company = { from: current.company, to: data.company };
  }

  // Early return if nothing changed — skip write, skip activity log, skip revalidation
  if (Object.keys(changes).length === 0) {
    return { changed: false };
  }

  // Write only the fields that were supplied (undefined falls back to current value)
  await db.user.update({
    where: { id: session.user.id },
    data: {
      name: data.name ?? current.name,
      phone: data.phone ?? current.phone,
      company: data.company ?? current.company,
    },
  });

  // Fan out a MEMBER_UPDATED activity log entry to all projects this user belongs to.
  // Uses createMany for a single round-trip — avoids N individual inserts.
  const memberships = await db.projectMember.findMany({
    where: { userId: session.user.id },
    select: { projectId: true },
  });

  if (memberships.length > 0) {
    await db.activityLog.createMany({
      data: memberships.map((m) => ({
        orgId: session.user.orgId!,
        action: "MEMBER_UPDATED" as never,
        message: `Profile updated: ${Object.keys(changes).join(", ")}`,
        data: { userId: session.user.id, changes },
        projectId: m.projectId,
        userId: session.user.id,
      })),
    });
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { changed: true, changes };
}
