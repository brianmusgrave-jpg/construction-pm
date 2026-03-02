"use server";

/**
 * @file ai-inspection.ts
 * @description AI-powered inspection features — Sprint 31.
 * 1. Inspection readiness check: AI evaluates if a phase is ready for inspection
 * 2. Inspection checklist generator: AI generates inspection prep checklist from phase context
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai";

const dbc = db as any;

export async function checkInspectionReadiness(
  phaseId: string,
  projectId: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const phase = await db.phase.findUnique({
      where: { id: phaseId },
      include: {
        checklist: { include: { items: true } },
      },
    });
    if (!phase) return { success: false, error: "Phase not found" };

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    const punchItems = await dbc.punchListItem.findMany({
      where: { phaseId },
      select: { title: true, status: true, priority: true },
    });

    const inspections = await dbc.inspection.findMany({
      where: { phaseId },
      select: { title: true, result: true, scheduledDate: true },
    });

    const openPunch = punchItems.filter((p: any) => p.status === "OPEN");
    const checklistItems = phase.checklist?.items || [];
    const completedItems = checklistItems.filter((i: any) => i.completed);
    const pastInspections = inspections.filter((i: any) => i.result);

    const messages = [
      {
        role: "system" as const,
        content: `You are a construction inspection readiness advisor.
Evaluate if this phase is ready for its next inspection based on checklist completion,
open punch list items, past inspection results, and phase status.
Return JSON: {
  "readyForInspection": boolean,
  "readinessScore": number (1-10),
  "blockers": ["string array of items blocking inspection readiness"],
  "warnings": ["string array of potential issues to address"],
  "strengths": ["string array of positive indicators"],
  "recommendation": "1-2 sentence overall recommendation",
  "suggestedInspectionType": "string (e.g., 'Rough-in', 'Final', 'Code compliance')"
}`,
      },
      {
        role: "user" as const,
        content: `Project: ${project?.name || "Unknown"}
Phase: ${phase.name}, Status: ${phase.status}, Progress: ${phase.progress}%
Checklist: ${completedItems.length}/${checklistItems.length} items complete
Open punch items: ${openPunch.length} (${openPunch.filter((p: any) => p.priority === "HIGH" || p.priority === "URGENT").length} high/urgent priority)
Past inspections: ${pastInspections.length} (${pastInspections.filter((i: any) => i.result === "FAIL").length} failures)

Evaluate inspection readiness for this phase.`,
      },
    ];

    const response = await callAI(messages, {
      feature: "ai_inspection_readiness",
      userId: session.user.id,
      temperature: 0.3,
      maxTokens: 600,
    });

    const text = response.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const readiness = JSON.parse(cleaned);

    return { success: true, readiness };
  } catch (e: any) {
    return { success: false, error: e.message || "Readiness check failed" };
  }
}

export async function generateInspectionChecklist(
  phaseId: string,
  projectId: string,
  inspectionType?: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const phase = await db.phase.findUnique({
      where: { id: phaseId },
      select: { name: true, status: true },
    });

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true, address: true },
    });

    const messages = [
      {
        role: "system" as const,
        content: `You are a construction inspection preparation advisor.
Generate a practical pre-inspection checklist for the specified phase and inspection type.
Return JSON: {
  "inspectionType": "string (confirmed or inferred inspection type)",
  "items": [
    {
      "category": "string (e.g., 'Documentation', 'Safety', 'Code Compliance', 'Quality')",
      "task": "string (specific actionable item)",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "notes": "string (brief guidance or tips)"
    }
  ],
  "commonFailPoints": ["string array of common reasons inspections fail for this type"],
  "documentsNeeded": ["string array of documents to have on-site"]
}
Generate 8-15 items covering documentation, safety, code compliance, and quality.`,
      },
      {
        role: "user" as const,
        content: `Project: ${project?.name || "Unknown"}, Address: ${project?.address || "N/A"}
Phase: ${phase?.name || "Unknown"}, Status: ${phase?.status}
Inspection type: ${inspectionType || "General"}

Generate a pre-inspection preparation checklist.`,
      },
    ];

    const response = await callAI(messages, {
      feature: "ai_inspection_checklist",
      userId: session.user.id,
      temperature: 0.4,
      maxTokens: 1000,
    });

    const text = response.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const checklist = JSON.parse(cleaned);

    return { success: true, checklist };
  } catch (e: any) {
    return { success: false, error: e.message || "Checklist generation failed" };
  }
}
