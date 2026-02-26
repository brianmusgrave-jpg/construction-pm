"use server";

/**
 * @file actions/voiceNotes.ts
 * @description Server actions for phase-level voice note management.
 *
 * Voice notes attach short audio recordings to a construction phase.
 * The audio file itself is stored externally (e.g. Cloudinary or S3) and
 * only the resulting URL, duration, and optional label are persisted here.
 *
 * The `VoiceNote` model was added after the last Prisma client generation,
 * so `db as any` casts (function-level `dbc`) are required throughout.
 *
 * Permission model:
 *   - Read (`getPhaseVoiceNotes`): any authenticated user.
 *   - Create (`createVoiceNote`): any authenticated user.
 *   - Delete (`deleteVoiceNote`): author OR global ADMIN only.
 *
 * Activity logging: `createVoiceNote` fires a fire-and-forget activity log
 * reusing the "PHASE_CREATED" action type (the closest available enum value;
 * a dedicated "VOICE_NOTE_ADDED" type should be added in a future migration).
 */

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Zod Schema ──

/** Validates the payload for creating a voice note. */
const CreateVoiceNoteSchema = z.object({
  phaseId: z.string().min(1),
  audioUrl: z.string().min(1),   // URL returned by the audio upload service
  duration: z.number().int().min(1), // Duration in seconds (must be ≥ 1)
  label: z.string().max(200).optional(), // Optional descriptive title
});

// ── Queries ──

/**
 * Fetch all voice notes for a phase, newest first.
 * Includes the creator's profile (id, name, email, image) for display.
 *
 * Returns an empty array on database error (e.g. if the voiceNote table does
 * not yet exist in the environment) rather than propagating the error.
 *
 * @param phaseId - The phase whose voice notes to fetch.
 * @throws "Unauthorized" if no session — callers are expected to be authenticated.
 */
export async function getPhaseVoiceNotes(phaseId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const dbc = db as any; // VoiceNote not in generated Prisma types
  try {
    const notes = await dbc.voiceNote.findMany({
      where: { phaseId },
      include: {
        createdBy: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" }, // Newest recordings first
    });
    return notes;
  } catch {
    // Return empty array if the voiceNote table doesn't exist yet in this env.
    return [];
  }
}

// ── Mutations ──

/**
 * Attach a new voice note to a phase.
 *
 * The audio file must be uploaded to external storage before calling this
 * action; only the resulting URL is stored here. The label is trimmed and
 * stored as null if empty.
 *
 * After creation, fires a fire-and-forget activity log entry. The log reuses
 * the "PHASE_CREATED" action type as the closest available value — a dedicated
 * "VOICE_NOTE_ADDED" enum value should be added in a future migration.
 * Errors in the activity log are silently swallowed (.catch(() => {})) so
 * they do not fail the main create operation.
 *
 * @param data - Validated voice note payload (phaseId, audioUrl, duration, label).
 * @returns The created VoiceNote with creator profile included.
 * @throws "Unauthorized" if no session.
 */
export async function createVoiceNote(
  data: z.infer<typeof CreateVoiceNoteSchema>
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = CreateVoiceNoteSchema.parse(data);

  const dbc = db as any; // VoiceNote not in generated Prisma types
  const note = await dbc.voiceNote.create({
    data: {
      phaseId: parsed.phaseId,
      audioUrl: parsed.audioUrl,
      duration: parsed.duration,
      label: parsed.label?.trim() || null, // Normalise empty string to null
      createdById: session.user.id,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  // Fetch the phase to get projectId for activity log and cache revalidation.
  const phase = await db.phase.findUnique({
    where: { id: parsed.phaseId },
    select: { name: true, projectId: true },
  });

  if (phase) {
    // Fire-and-forget: activity log failure must not fail the create response.
    // TODO: Replace "PHASE_CREATED" with a dedicated "VOICE_NOTE_ADDED" action
    // once the ActivityAction enum is extended in a future migration.
    db.activityLog
      .create({
        data: {
          action: "PHASE_CREATED" as any, // Closest available action type
          message: `${session.user.name || session.user.email} added a voice note to ${phase.name}`,
          projectId: phase.projectId,
          userId: session.user.id,
          data: { phaseId: parsed.phaseId, voiceNoteId: note.id },
        },
      })
      .catch(() => {}); // Intentionally swallowed

    revalidatePath(`/dashboard/projects/${phase.projectId}`);
  }

  return note;
}

/**
 * Delete a voice note.
 *
 * Permission: the note's author OR a global ADMIN may delete. Project managers
 * without authorship cannot delete voice notes left by other users.
 *
 * The voice note row is fetched with its parent phase so the correct project
 * path can be revalidated without a separate query.
 *
 * @param noteId - ID of the VoiceNote to delete.
 * @returns `{ success: true }` on success.
 * @throws "Unauthorized" if no session.
 * @throws "Voice note not found" if the ID does not exist.
 * @throws "Not authorized to delete this voice note" if role check fails.
 */
export async function deleteVoiceNote(noteId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const dbc = db as any; // VoiceNote not in generated Prisma types
  // Include phase to get projectId for cache revalidation without extra query.
  const note = await dbc.voiceNote.findUnique({
    where: { id: noteId },
    include: { phase: { select: { projectId: true } } },
  });

  if (!note) throw new Error("Voice note not found");

  // Authors can always delete their own notes; ADMINs can delete any note.
  const userRole = (session.user as { role?: string }).role;
  if (note.createdById !== session.user.id && userRole !== "ADMIN") {
    throw new Error("Not authorized to delete this voice note");
  }

  await dbc.voiceNote.delete({ where: { id: noteId } });

  revalidatePath(`/dashboard/projects/${note.phase.projectId}`);
  return { success: true };
}
