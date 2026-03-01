"use server";

/**
 * @file src/actions/keeney.ts
 * @description Server actions for Keeney Mode — voice-first field interface.
 *
 * Sprint 21 — processes voice memos into daily logs, punch list items,
 * weather delays, and other project records.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────

interface VoiceMemoIntent {
  project: { id: string; name: string; confidence: number } | null;
  actionType: string;
  summary: string;
  details: string;
  scheduleImpact: string | null;
  notify: string[];
  needsClarification: string | null;
  language: string;
}

interface ProcessVoiceMemoInput {
  transcript: string;
  intent: VoiceMemoIntent;
  commandType: string;
  language: string;
  recordedAt: string; // ISO timestamp
  audioUrl?: string;
}

interface ProcessVoiceMemoResult {
  success: boolean;
  memoId?: string;
  actionsTaken: string[];
  error?: string;
}

// ── Project context for LLM ──────────────────────────────────────────

/**
 * Get the user's assigned projects for LLM context during voice parsing.
 * Returns minimal project info — just enough for the LLM to match references.
 */
export async function getKeeneyProjectContext(userId: string) {
  const dbc = db as any;
  const memberships = await dbc.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        select: { id: true, name: true, address: true, status: true },
      },
    },
  });

  return memberships
    .filter((m: any) => m.project.status !== "ARCHIVED")
    .map((m: any) => ({
      id: m.project.id,
      name: m.project.name,
      address: m.project.address,
    }));
}

// ── Process confirmed voice memo ─────────────────────────────────────

/**
 * Process a confirmed voice memo — create the VoiceMemo record and
 * execute the appropriate action (daily log, punch list, etc.).
 *
 * Called after the user confirms the parsed intent on the client.
 */
export async function processVoiceMemo(
  input: ProcessVoiceMemoInput
): Promise<ProcessVoiceMemoResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, actionsTaken: [], error: "Unauthorized" };
  }

  const userId = session.user.id;
  const dbc = db as any;
  const actionsTaken: string[] = [];

  try {
    // 1. Create the VoiceMemo record
    const memo = await dbc.voiceMemo.create({
      data: {
        userId,
        projectId: input.intent.project?.id ?? null,
        audioUrl: input.audioUrl ?? null,
        transcript: input.transcript,
        parsedIntent: input.intent as any,
        actionType: input.intent.actionType,
        commandType: input.commandType,
        language: input.language,
        source: "keeney_voice",
        recordedAt: new Date(input.recordedAt),
        processedAt: new Date(),
      },
    });
    actionsTaken.push("voice_memo_saved");

    // 2. Execute action based on type
    const projectId = input.intent.project?.id;

    switch (input.intent.actionType) {
      case "daily_log":
        if (projectId) {
          await createDailyLogFromMemo(userId, projectId, input);
          actionsTaken.push("daily_log_created");
        }
        break;

      case "weather_delay":
        if (projectId) {
          await createWeatherDelayLog(userId, projectId, input);
          actionsTaken.push("weather_delay_logged");
        }
        break;

      case "punch_list":
        if (projectId) {
          await createPunchListFromMemo(userId, projectId, input);
          actionsTaken.push("punch_list_created");
        }
        break;

      case "general_note":
      case "photo_note":
        // Just the VoiceMemo record is sufficient
        actionsTaken.push("note_saved");
        break;

      case "schedule_update":
        // Future: update schedule phases
        actionsTaken.push("note_saved");
        break;
    }

    // 3. Log activity
    if (projectId) {
      await dbc.activityLog.create({
        data: {
          type: "VOICE_MEMO",
          description: input.intent.summary,
          userId,
          projectId,
          metadata: { source: "keeney_voice", actionType: input.intent.actionType, memoId: memo.id },
        },
      }).catch(() => {}); // fire-and-forget
    }

    // 4. Send notifications (fire-and-forget)
    if (projectId && input.intent.notify.length > 0) {
      sendMemoNotifications(userId, projectId, input.intent).catch(() => {});
    }

    return { success: true, memoId: memo.id, actionsTaken };
  } catch (err) {
    console.error("processVoiceMemo error:", err);
    const msg = err instanceof Error ? err.message : "Failed to process voice memo";
    return { success: false, actionsTaken, error: msg };
  }
}

// ── Action helpers ───────────────────────────────────────────────────

async function createDailyLogFromMemo(
  userId: string,
  projectId: string,
  input: ProcessVoiceMemoInput
) {
  const dbc = db as any;
  const today = new Date().toISOString().split("T")[0];

  await dbc.dailyLog.create({
    data: {
      projectId,
      authorId: userId,
      date: new Date(today),
      workSummary: input.intent.summary,
      notes: input.intent.details,
      issues: input.intent.scheduleImpact ?? undefined,
    },
  });
}

async function createWeatherDelayLog(
  userId: string,
  projectId: string,
  input: ProcessVoiceMemoInput
) {
  const dbc = db as any;
  const today = new Date().toISOString().split("T")[0];

  await dbc.dailyLog.create({
    data: {
      projectId,
      authorId: userId,
      date: new Date(today),
      weather: "Rain/Weather Delay",
      workSummary: `⛈️ Weather Delay: ${input.intent.summary}`,
      notes: input.intent.details,
      issues: input.intent.scheduleImpact ?? "Weather delay — schedule impact TBD",
    },
  });
}

async function createPunchListFromMemo(
  userId: string,
  projectId: string,
  input: ProcessVoiceMemoInput
) {
  const dbc = db as any;

  // Find the first active phase to attach the punch list item to
  const phase = await dbc.phase.findFirst({
    where: { project: { id: projectId } },
    orderBy: { sortOrder: "asc" },
  });

  if (!phase) return;

  await dbc.punchListItem.create({
    data: {
      phaseId: phase.id,
      title: input.intent.summary,
      description: input.intent.details,
      priority: "MEDIUM",
      status: "OPEN",
      createdById: userId,
    },
  });
}

async function sendMemoNotifications(
  userId: string,
  projectId: string,
  intent: VoiceMemoIntent
) {
  const dbc = db as any;

  // Get project members to notify based on roles
  const rolesToNotify = intent.notify.map((n) => {
    switch (n) {
      case "project_manager": return "MANAGER";
      case "admin": return "OWNER";
      case "contractor": return "CONTRACTOR";
      default: return "MANAGER";
    }
  });

  const members = await dbc.projectMember.findMany({
    where: {
      projectId,
      role: { in: rolesToNotify },
      userId: { not: userId }, // don't notify yourself
    },
    select: { userId: true },
  });

  // Create notifications for each target
  for (const member of members) {
    await dbc.notification.create({
      data: {
        userId: member.userId,
        type: "VOICE_MEMO",
        title: `Voice memo: ${intent.actionType.replace("_", " ")}`,
        message: intent.summary,
        projectId,
      },
    }).catch(() => {});
  }
}

// ── Keeney Mode user preference ──────────────────────────────────────

/**
 * Toggle Keeney Mode on/off for the current user.
 */
export async function toggleKeeneyMode(enabled: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  const dbc = db as any;
  await dbc.user.update({
    where: { id: session.user.id },
    data: { keeneyMode: enabled },
  });

  return { success: true, keeneyMode: enabled };
}

/**
 * Get Keeney Mode status for the current user.
 */
export async function getKeeneyModeStatus() {
  const session = await auth();
  if (!session?.user?.id) return false;

  const dbc = db as any;
  const user = await dbc.user.findUnique({
    where: { id: session.user.id },
    select: { keeneyMode: true },
  });

  return user?.keeneyMode ?? false;
}
