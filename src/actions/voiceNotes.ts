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
import { callAI } from "@/lib/ai";

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

// ── AI Features ───────────────────────────────────────────────────────────

/**
 * Transcribe a voice note's audio using OpenAI Whisper.
 *
 * Fetches the audio from its CDN URL, sends it to the Whisper API
 * (`whisper-1`), persists the returned transcript on the VoiceNote record,
 * and revalidates the project path.
 *
 * Requires `OPENAI_API_KEY` to be set in the environment.
 *
 * @param noteId - ID of the VoiceNote to transcribe.
 * @returns `{ transcript: string }` on success.
 * @throws "Unauthorized" if no session.
 * @throws "Voice note not found" if the ID does not exist.
 * @throws "OPENAI_API_KEY not configured" if the env var is missing.
 * @throws "Whisper API error: …" on upstream failure.
 */
export async function transcribeVoiceNote(noteId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const dbc = db as any;
  const note = await dbc.voiceNote.findUnique({
    where: { id: noteId },
    include: { phase: { select: { projectId: true } } },
  });
  if (!note) throw new Error("Voice note not found");

  // Fetch the audio blob from its CDN URL
  const audioResponse = await fetch(note.audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
  }
  const audioBuffer = await audioResponse.arrayBuffer();
  const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });

  // Build multipart form for Whisper
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", "whisper-1");
  formData.append("response_format", "text");

  const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!whisperRes.ok) {
    const body = await whisperRes.text();
    throw new Error(`Whisper API error: ${whisperRes.status} ${body.slice(0, 200)}`);
  }

  const transcript = (await whisperRes.text()).trim();

  // Persist the transcript
  await dbc.voiceNote.update({
    where: { id: noteId },
    data: { transcript },
  });

  revalidatePath(`/dashboard/projects/${note.phase.projectId}`);
  return { transcript };
}

/**
 * Extract actionable construction tasks from a voice note transcript.
 *
 * Routes through `callAI()` using the org's configured AI provider.
 * Returns a plain list of task strings — nothing is persisted; the caller
 * decides whether to create actual Task records.
 *
 * @param transcript - The raw transcript text to analyse.
 * @param userId     - Used for AI usage logging attribution.
 * @returns `{ tasks: string[] }` — may be an empty array if no tasks found.
 * @throws "Unauthorized" if no session.
 * @throws "AI disabled" if AI is turned off in settings.
 * @throws "Task extraction failed: …" on AI call failure.
 */
export async function extractTasksFromTranscript(
  transcript: string,
  userId: string
): Promise<{ tasks: string[] }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const result = await callAI(
    [
      {
        role: "system",
        content:
          "You are a construction project assistant. Extract concrete, actionable tasks from the transcript below. " +
          "Return ONLY a JSON object with a single key \"tasks\" whose value is an array of short task strings (each under 100 characters). " +
          "If no clear tasks are mentioned, return {\"tasks\": []}. " +
          "Do NOT include any other text, explanation, or markdown — only valid JSON.",
      },
      {
        role: "user",
        content: `Transcript:\n${transcript}`,
      },
    ],
    {
      maxTokens: 512,
      temperature: 0.2,
      feature: "task_extraction",
      userId,
    }
  );

  if (!result.success || !result.text) {
    if (result.error === "ai_disabled") throw new Error("AI disabled");
    throw new Error(`Task extraction failed: ${result.error ?? "unknown error"}`);
  }

  try {
    // Strip markdown fences if present (some models wrap JSON in ```)
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned) as { tasks?: unknown };
    const tasks = Array.isArray(parsed.tasks)
      ? (parsed.tasks as unknown[]).filter((t): t is string => typeof t === "string")
      : [];
    return { tasks };
  } catch {
    // If the model returned non-JSON, return empty rather than throwing
    return { tasks: [] };
  }
}
