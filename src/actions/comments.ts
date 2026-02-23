"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const AddPhaseCommentSchema = z.object({
  phaseId: z.string().min(1),
  content: z.string().min(1).max(5000),
});

// Get comments for a phase (newest first)
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

// Add a comment to a phase
export async function addPhaseComment(
  data: z.infer<typeof AddPhaseCommentSchema>
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = AddPhaseCommentSchema.parse(data);

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

  // Get phase info for activity log
  const phase = await db.phase.findUnique({
    where: { id: parsed.phaseId },
    select: { name: true, projectId: true },
  });

  if (phase) {
    // Log activity (fire-and-forget)
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

// Delete a comment (only author or admin)
export async function deletePhaseComment(commentId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const comment = await db.phaseComment.findUnique({
    where: { id: commentId },
    include: { phase: { select: { projectId: true } } },
  });

  if (!comment) throw new Error("Comment not found");

  // Only author or admin can delete
  const userRole = (session.user as { role?: string }).role;
  if (comment.userId !== session.user.id && userRole !== "ADMIN") {
    throw new Error("Not authorized to delete this comment");
  }

  await db.phaseComment.delete({ where: { id: commentId } });

  // Log activity (fire-and-forget)
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
