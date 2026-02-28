"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateVoiceNoteSchema = z.object({
  phaseId: z.string().min(1),
  audioUrl: z.string().min(1),
  duration: z.number().int().min(1),
  label: z.string().max(200).optional(),
});

// Get voice notes for a phase (newest first)
export async function getPhaseVoiceNotes(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const dbc = db as any;
  try {
    const notes = await dbc.voiceNote.findMany({
      where: { phaseId },
      include: {
        createdBy: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return notes;
  } catch {
    return [];
  }
}

// Create a voice note
export async function createVoiceNote(
  data: z.infer<typeof CreateVoiceNoteSchema>
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = CreateVoiceNoteSchema.parse(data);

  const dbc = db as any;
  const note = await dbc.voiceNote.create({
    data: {
      phaseId: parsed.phaseId,
      audioUrl: parsed.audioUrl,
      duration: parsed.duration,
      label: parsed.label?.trim() || null,
      createdById: session.user.id,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  // Get phase info for activity log
  const phase = await db.phase.findUnique({
    where: { id: parsed.phaseId },
    select: { name: true, projectId: true },
  });

  if (phase) {
    db.activityLog
      .create({
        data: {
          action: "PHASE_CREATED" as any, // Reuse closest activity type
          message: `${session.user.name || session.user.email} added a voice note to ${phase.name}`,
          projectId: phase.projectId,
          userId: session.user.id,
          data: { phaseId: parsed.phaseId, voiceNoteId: note.id },
        },
      })
      .catch(() => {});

    revalidatePath(`/dashboard/projects/${phase.projectId}`);
  }

  return note;
}

// Delete a voice note (only author or admin)
export async function deleteVoiceNote(noteId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const dbc = db as any;
  const note = await dbc.voiceNote.findUnique({
    where: { id: noteId },
    include: { phase: { select: { projectId: true } } },
  });

  if (!note) throw new Error("Voice note not found");

  const userRole = (session.user as { role?: string }).role;
  if (note.createdById !== session.user.id && userRole !== "ADMIN") {
    throw new Error("Not authorized to delete this voice note");
  }

  await dbc.voiceNote.delete({ where: { id: noteId } });

  revalidatePath(`/dashboard/projects/${note.phase.projectId}`);
  return { success: true };
}
