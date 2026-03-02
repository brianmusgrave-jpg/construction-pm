"use server";

/**
 * @file ai-drawing.ts
 * @description AI-powered drawing management features — Sprint 33.
 * 1. Revision diff analysis: AI compares two revisions of a drawing to highlight changes
 * 2. Drawing set completeness check: AI evaluates if the drawing set is complete for the phase scope
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai";

const dbc = db as any;

export async function analyzeRevisionChanges(
  drawingId: string,
  projectId: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const drawing = await dbc.drawing.findUnique({ where: { id: drawingId } });
    if (!drawing) return { success: false, error: "Drawing not found" };

    // Find all drawings with same number but different revisions
    const revisions = await dbc.drawing.findMany({
      where: {
        phaseId: drawing.phaseId,
        drawingNumber: drawing.drawingNumber,
      },
      orderBy: { revision: "asc" },
    });

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    const phase = await db.phase.findUnique({
      where: { id: drawing.phaseId },
      select: { name: true, status: true },
    });

    const messages = [
      {
        role: "system" as const,
        content: `You are a construction document control analyst.
Analyze a drawing and its revision history to identify likely changes, impacts, and coordination needs.
Return JSON: {
  "revisionCount": number,
  "changesSummary": "string (2-3 sentence summary of likely changes between revisions)",
  "impactAreas": [
    {
      "area": "string (affected area, e.g., 'structural framing', 'MEP routing')",
      "impact": "HIGH" | "MEDIUM" | "LOW",
      "description": "string (what changed and why it matters)"
    }
  ],
  "coordinationNeeded": ["string array of trades/disciplines that need to be notified"],
  "rfiRisk": "HIGH" | "MEDIUM" | "LOW",
  "rfiRiskReason": "string (why this revision might generate RFIs)",
  "recommendations": ["string array of recommended actions"]
}`,
      },
      {
        role: "user" as const,
        content: `Project: ${project?.name || "Unknown"}
Phase: ${phase?.name || "Unknown"}, Status: ${phase?.status}
Drawing: ${drawing.drawingNumber} — "${drawing.title}"
Discipline: ${drawing.discipline}
Current Revision: ${drawing.revision}
Description: ${drawing.description || "N/A"}
Sheet Size: ${drawing.sheetSize || "N/A"}, Scale: ${drawing.scale || "N/A"}

Revision history (${revisions.length} revisions):
${revisions.map((r: any) => `- Rev ${r.revision}: "${r.title}" (${r.description || "no description"})`).join("\n")}

Analyze the revision history and likely changes for this drawing.`,
      },
    ];

    const response = await callAI(messages, {
      feature: "ai_drawing_revision",
      userId: session.user.id,
      temperature: 0.3,
      maxTokens: 800,
    });

    const text = response.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const analysis = JSON.parse(cleaned);

    return { success: true, analysis };
  } catch (e: any) {
    return { success: false, error: e.message || "Revision analysis failed" };
  }
}

export async function checkDrawingSetCompleteness(
  phaseId: string,
  projectId: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const drawings = await dbc.drawing.findMany({
      where: { phaseId },
      orderBy: [{ discipline: "asc" }, { drawingNumber: "asc" }],
    });

    if (drawings.length === 0) {
      return { success: false, error: "No drawings found for this phase" };
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    const phase = await db.phase.findUnique({
      where: { id: phaseId },
      select: { name: true, status: true },
    });

    const drawingSummary = drawings.map((d: any) => ({
      number: d.drawingNumber,
      title: d.title,
      discipline: d.discipline,
      revision: d.revision,
      status: d.status,
    }));

    const disciplines = [...new Set(drawings.map((d: any) => d.discipline))];

    const messages = [
      {
        role: "system" as const,
        content: `You are a construction document control expert.
Evaluate whether the drawing set is complete for the given phase scope.
Return JSON: {
  "completenessScore": number (1-10),
  "status": "COMPLETE" | "MOSTLY_COMPLETE" | "INCOMPLETE" | "CRITICAL_GAPS",
  "disciplineCoverage": [
    {
      "discipline": "string",
      "drawingCount": number,
      "assessment": "ADEQUATE" | "NEEDS_MORE" | "MISSING",
      "missingTypes": ["string array of likely missing drawing types"]
    }
  ],
  "missingDrawings": [
    {
      "suggestedNumber": "string (e.g., 'M-101')",
      "title": "string (suggested drawing title)",
      "discipline": "string",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "reason": "string (why this drawing is needed)"
    }
  ],
  "versioningIssues": ["string array of versioning concerns"],
  "recommendations": ["string array of recommendations"]
}`,
      },
      {
        role: "user" as const,
        content: `Project: ${project?.name || "Unknown"}
Phase: ${phase?.name || "Unknown"}, Status: ${phase?.status}
Total drawings: ${drawings.length}
Disciplines represented: ${disciplines.join(", ")}

Drawing set:
${drawingSummary.map((d: any) => `- ${d.number} (${d.discipline}): "${d.title}" Rev ${d.revision}, Status: ${d.status || "CURRENT"}`).join("\n")}

Evaluate the completeness of this drawing set for the phase scope.`,
      },
    ];

    const response = await callAI(messages, {
      feature: "ai_drawing_completeness",
      userId: session.user.id,
      temperature: 0.3,
      maxTokens: 1000,
    });

    const text = response.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const completeness = JSON.parse(cleaned);

    return { success: true, completeness };
  } catch (e: any) {
    return { success: false, error: e.message || "Completeness check failed" };
  }
}
