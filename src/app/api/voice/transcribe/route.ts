/**
 * @file POST /api/voice/transcribe
 * @description Keeney Mode voice pipeline endpoint.
 *
 * Receives audio + command context → transcribes via Groq Whisper →
 * parses intent via LLM → returns structured action for client confirmation.
 *
 * Sprint 21 — Keeney Mode
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { transcribeAudio, callAI } from "@/lib/ai";
import type { AIMessage } from "@/lib/ai";

// Types for the parsed intent response
interface ParsedProject {
  id: string;
  name: string;
  confidence: number;
}

interface ParsedIntent {
  project: ParsedProject | null;
  actionType: string;
  summary: string;
  details: string;
  scheduleImpact: string | null;
  notify: string[];
  needsClarification: string | null;
  language: string;
}

export async function POST(req: NextRequest) {
  // Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const commandType = (formData.get("commandType") as string) ?? "voice_memo";
    const languageHint = formData.get("languageHint") as string | undefined;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Step 1: Transcribe audio
    const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type || "audio/webm" });
    const transcription = await transcribeAudio(audioBlob, languageHint || undefined);

    if (!transcription.success || !transcription.text.trim()) {
      return NextResponse.json({
        error: "Transcription failed",
        details: transcription.error || "Empty transcript",
      }, { status: 422 });
    }

    // Step 2: Get user's project context for LLM
    const { getKeeneyProjectContext } = await import("@/actions/keeney");
    const projectContext = await getKeeneyProjectContext(session.user.id);

    // Step 3: Parse intent via LLM
    const systemPrompt = buildSystemPrompt(
      session.user.name ?? "User",
      projectContext,
      commandType,
      transcription.language
    );

    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcription.text },
    ];

    const aiResponse = await callAI(messages, {
      provider: "GROQ",
      model: "llama-3.3-70b-versatile",
      maxTokens: 1024,
      temperature: 0.2,
      feature: "keeney_intent_parse",
      userId: session.user.id,
    });

    if (!aiResponse.success || !aiResponse.text) {
      return NextResponse.json({
        error: "Intent parsing failed",
        details: aiResponse.error,
        // Still return transcript so user can retry or manually log
        transcript: transcription.text,
        language: transcription.language,
      }, { status: 422 });
    }

    // Parse the LLM JSON response
    let parsedIntent: ParsedIntent;
    try {
      // Strip markdown code fences if present
      let jsonText = aiResponse.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsedIntent = JSON.parse(jsonText);
    } catch {
      // If LLM didn't return valid JSON, create a general note
      parsedIntent = {
        project: null,
        actionType: "general_note",
        summary: transcription.text.slice(0, 200),
        details: transcription.text,
        scheduleImpact: null,
        notify: [],
        needsClarification: "Could not parse intent. Please confirm project and action.",
        language: transcription.language,
      };
    }

    return NextResponse.json({
      transcript: transcription.text,
      language: transcription.language,
      intent: parsedIntent,
      commandType,
    });
  } catch (err) {
    console.error("Voice transcribe error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── System prompt builder ────────────────────────────────────────────────

function buildSystemPrompt(
  userName: string,
  projects: Array<{ id: string; name: string; address: string | null }>,
  commandType: string,
  language: string
): string {
  const projectList = projects
    .map((p) => `- "${p.name}" (ID: ${p.id})${p.address ? ` at ${p.address}` : ""}`)
    .join("\n");

  const now = new Date().toISOString();

  return `You are a voice memo parser for a construction project management app.
The user is "${userName}", a field worker who just recorded a voice memo.
Current date/time: ${now}

AVAILABLE PROJECTS:
${projectList || "No projects assigned."}

COMMAND CONTEXT: ${commandType}
${commandType === "weather_delay" ? "The user specifically chose 'Weather Delay' — expect weather-related content." : ""}
${commandType === "flag_issue" ? "The user specifically chose 'Flag Issue' — expect a punch list item or defect." : ""}
${commandType === "photo_note" ? "The user is attaching a photo — focus on location and defect description." : ""}

INSTRUCTIONS:
1. Identify which project the memo refers to. Match by name, address, or context clues.
2. Determine the action type: daily_log, weather_delay, punch_list, photo_note, schedule_update, or general_note.
3. Summarize what should be logged in a concise sentence.
4. Extract any schedule impact mentions.
5. Determine who should be notified (project_manager, admin, contractor — or empty array).
6. If the project is ambiguous, set needsClarification to a question asking which project.
7. RESPOND IN THE SAME LANGUAGE AS THE TRANSCRIPT (${language}).

Respond ONLY with valid JSON in this exact format:
{
  "project": { "id": "...", "name": "...", "confidence": 0.0-1.0 } or null,
  "actionType": "daily_log|weather_delay|punch_list|photo_note|schedule_update|general_note",
  "summary": "Brief summary of what to log",
  "details": "Full details extracted from the memo",
  "scheduleImpact": "Description of schedule impact" or null,
  "notify": ["project_manager"],
  "needsClarification": "Question for the user" or null,
  "language": "${language}"
}`;
}
