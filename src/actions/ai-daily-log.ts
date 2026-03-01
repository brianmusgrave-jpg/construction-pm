"use server";

/**
 * @file actions/ai-daily-log.ts
 * @description Sprint 22 — #70 AI Daily Log Generation.
 *
 * Auto-drafts a daily log workSummary by synthesising:
 *   - Recent voice memos (Keeney Mode) for the project
 *   - Recent activity log entries for the project
 *   - Any existing voice notes with transcripts on active phases
 *
 * Returns a draft object the user can review / edit before saving.
 * Does NOT create the DailyLog record — that's done by `createDailyLog`
 * after the user confirms.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai";

export interface DailyLogDraft {
  workSummary: string;
  issues: string;
  notes: string;
  weather: string;
  crewCount: number | null;
  equipment: string;
  sourcesUsed: string[];
}

/**
 * Generate an AI-drafted daily log for a project and date.
 *
 * Gathers voice memos, voice notes, and activity from the last 24h,
 * then asks the AI to synthesise a professional daily field report.
 *
 * @param projectId - The project to generate for
 * @param date - ISO date string (YYYY-MM-DD) — defaults to today
 * @returns DailyLogDraft with pre-filled fields
 */
export async function generateDailyLogDraft(
  projectId: string,
  date?: string
): Promise<DailyLogDraft> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const targetDate = date || new Date().toISOString().split("T")[0];
  const dayStart = new Date(`${targetDate}T00:00:00Z`);
  const dayEnd = new Date(`${targetDate}T23:59:59Z`);

  const dbc = db as any;
  const sourcesUsed: string[] = [];

  // 1. Gather voice memos from Keeney Mode for this project/day
  let voiceMemos: Array<{ transcript: string; actionType: string; createdAt: Date }> = [];
  try {
    voiceMemos = await dbc.voiceMemo.findMany({
      where: {
        projectId,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      select: { transcript: true, actionType: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    if (voiceMemos.length > 0) sourcesUsed.push(`${voiceMemos.length} voice memo(s)`);
  } catch {
    // VoiceMemo table may not exist yet
  }

  // 2. Gather voice notes from active phases with transcripts
  let voiceNotes: Array<{ transcript: string; label: string | null; phase: { name: string } }> = [];
  try {
    voiceNotes = await dbc.voiceNote.findMany({
      where: {
        phase: { projectId },
        transcript: { not: null },
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      select: {
        transcript: true,
        label: true,
        phase: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    if (voiceNotes.length > 0) sourcesUsed.push(`${voiceNotes.length} voice note(s)`);
  } catch {
    // VoiceNote table may not exist yet
  }

  // 3. Gather activity log entries for this project/day
  let activities: Array<{ action: string; message: string; createdAt: Date }> = [];
  try {
    activities = await (db as any).activityLog.findMany({
      where: {
        projectId,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      select: { action: true, message: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 30,
    });
    if (activities.length > 0) sourcesUsed.push(`${activities.length} activity log(s)`);
  } catch {
    // Activity log may be empty
  }

  // 4. Build context for the AI
  const contextParts: string[] = [];

  if (voiceMemos.length > 0) {
    contextParts.push("## Voice Memos (Keeney Mode)");
    for (const vm of voiceMemos) {
      contextParts.push(`- [${vm.actionType}] ${vm.transcript}`);
    }
  }

  if (voiceNotes.length > 0) {
    contextParts.push("\n## Phase Voice Notes");
    for (const vn of voiceNotes) {
      contextParts.push(`- [${vn.phase.name}${vn.label ? ` — ${vn.label}` : ""}] ${vn.transcript}`);
    }
  }

  if (activities.length > 0) {
    contextParts.push("\n## Activity Log");
    for (const act of activities) {
      contextParts.push(`- ${act.message}`);
    }
  }

  if (contextParts.length === 0) {
    return {
      workSummary: "",
      issues: "",
      notes: "",
      weather: "",
      crewCount: null,
      equipment: "",
      sourcesUsed: [],
    };
  }

  // 5. Call AI to generate the draft
  const result = await callAI(
    [
      {
        role: "system",
        content:
          `You are a construction project superintendent assistant. Generate a professional daily field report from the raw field data below. ` +
          `Date: ${targetDate}. ` +
          `Return ONLY valid JSON with these keys:\n` +
          `- "workSummary": 2-4 sentences summarising today's work completed and progress\n` +
          `- "issues": any issues, delays, or problems mentioned (empty string if none)\n` +
          `- "notes": any additional observations or follow-up items (empty string if none)\n` +
          `- "weather": weather conditions if mentioned (empty string if not)\n` +
          `- "crewCount": number of crew members if mentioned (null if not)\n` +
          `- "equipment": equipment on site if mentioned (empty string if not)\n\n` +
          `Be factual and professional. Do NOT invent details not present in the source data.`,
      },
      {
        role: "user",
        content: contextParts.join("\n"),
      },
    ],
    {
      maxTokens: 1024,
      temperature: 0.2,
      feature: "daily_log_generation",
      userId: session.user.id,
    }
  );

  if (!result.success || !result.text) {
    throw new Error(`AI daily log generation failed: ${result.error ?? "unknown"}`);
  }

  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      workSummary: parsed.workSummary || "",
      issues: parsed.issues || "",
      notes: parsed.notes || "",
      weather: parsed.weather || "",
      crewCount: typeof parsed.crewCount === "number" ? parsed.crewCount : null,
      equipment: parsed.equipment || "",
      sourcesUsed,
    };
  } catch {
    // If JSON parsing fails, use the raw text as work summary
    return {
      workSummary: result.text.slice(0, 2000),
      issues: "",
      notes: "",
      weather: "",
      crewCount: null,
      equipment: "",
      sourcesUsed,
    };
  }
}
