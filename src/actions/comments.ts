"use server";

/**
 * @file actions/comments.ts
 * @description Server actions for phase-level discussion comments.
 *
 * Phase comments allow project team members to leave notes, questions, and
 * status updates directly on a phase. Comments are tied to a phase (not a project)
 * and are returned newest-first for the comment feed.
 *
 * Access model:
 *   - Read (`getPhaseComments`): any authenticated user
 *   - Write (`addPhaseComment`): any authenticated user
 *   - Delete (`deletePhaseComment`): author OR ADMIN only
 *
 * Input validation:
 *   Zod is used to validate `phaseId` and `content` before writing.
 *   The `content` field is trimmed on the server side regardless of client-side
 *   sanitisation; empty strings after trim are rejected.
 *
 * Activity logging:
 *   Both `addPhaseComment` and `deletePhaseComment` write to the activity log
 *   via fire-and-forget (.catch(() => {})) — the comment operation itself is
 *   never blocked by log write failures.
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Zod Schema ──

/** Validates the add-comment payload. Content cap at 5000 chars to avoid
 *  oversized comment blobs while still allowing detailed notes. */
const AddPhaseCommentSchema = z.object({
  phaseId: z.string().min(1),
  content: z.string().min(1).max(5000),
});

// ── Queries ──

/**
 * Fetch all comments for a phase, newest first.
 * Includes the author's display name, email, and avatar image.
 *
 * @param phaseId - ID of the phase to fetch comments for.
 */
export async function getPhaseComments(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return db.phaseComment.findMany({
    where: { phaseId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ── Mutations ──

/**
 * Add a comment to a phase.
 * Input is validated with Zod and the content is trimmed server-side.
 *
 * After creation, looks up the phase to:
 *   - Determine the `projectId` for cache revalidation.
 *   - Write a COMMENT_ADDED activity log entry (fire-and-forget).
 *
 * @param data.phaseId  - Phase to comment on.
 * @param data.content  - Comment text (1–5000 chars, trimmed).
 * @returns The created comment with the author's user object included.
 */
export async function addPhaseComment(
  data: z.infer<typeof AddPhaseCommentSchema>
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = AddPhaseCommentSchema.parse(data);

  // Secondary trim guard — belt-and-suspenders against whitespace-only input
  if (!parsed.content.trim()) throw new Error("Comment cannot be empty");

  const comment = await db.phaseComment.create({
    data: {
      phaseId: parsed.phaseId,
      userId: session.user.id,
      content: parsed.content.trim(),
    },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  // Look up phase to get projectId for activity log + cache revalidation
  const phase = await db.phase.findUnique({
    where: { id: parsed.phaseId },
    select: { name: true, projectId: true },
  });

  if (phase) {
    // Activity log — fire-and-forget
    db.activityLog
      .create({
        data: {
          action: "COMMENT_ADDED",
          message: `${session.user.name || session.user.email} commented on ${phase.name}`,
          projectId: phase.projectId,
          userId: session.user.id,
          data: { phaseId: parsed.phaseId, commentId: comment.id },
        },
      })
      .catch(() => {});

    revalidatePath(`/dashboard/projects/${phase.projectId}`);
  }

  return comment;
}

/**
 * Delete a phase comment.
 *
 * Authorization: only the comment author or an ADMIN may delete.
 * This prevents other project members from silently removing comments —
 * the audit trail should remain intact unless the author retracts or an
 * admin removes inappropriate content.
 *
 * Logs a COMMENT_DELETED activity entry after deletion (fire-and-forget).
 *
 * @param commentId - ID of the comment to delete.
 * @returns `{ success: true }` on deletion.
 */
export async function deletePhaseComment(commentId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const comment = await db.phaseComment.findUnique({
    where: { id: commentId },
    include: { phase: { select: { projectId: true } } },
  });

  if (!comment) throw new Error("Comment not found");

  // Author may always delete their own comment; ADMIN may delete any comment
  const userRole = (session.user as { role?: string }).role;
  if (comment.userId !== session.user.id && userRole !== "ADMIN") {
    throw new Error("Not authorized to delete this comment");
  }

  await db.phaseComment.delete({ where: { id: commentId } });

  // Activity log — fire-and-forget
  db.activityLog
    .create({
      data: {
        action: "COMMENT_DELETED",
        message: `Deleted comment on phase`,
        projectId: comment.phase.projectId,
        userId: session.user.id,
        data: { commentId },
      },
    })
    .catch(() => {});

  revalidatePath(`/dashboard/projects/${comment.phase.projectId}`);
  return { success: true };
}
