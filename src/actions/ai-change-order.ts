"use server";

/**
 * @file ai-change-order.ts
 * @description AI-powered change order features — Sprint 31.
 * 1. Impact analysis: AI assesses schedule/budget/scope impact of a proposed CO
 * 2. CO draft from description: AI generates a structured change order from natural language
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai";

const dbc = db as any;

export async function analyzeChangeOrderImpact(
  changeOrderId: string,
  projectId: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const co = await dbc.changeOrder.findUnique({ where: { id: changeOrderId } });
    if (!co) return { success: false, error: "Change order not found" };

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true, budget: true, status: true },
    });

    const phase = await db.phase.findUnique({
      where: { id: co.phaseId },
      select: { name: true, estStart: true, estEnd: true, status: true },
    });

    const otherCOs = await dbc.changeOrder.findMany({
      where: { phaseId: co.phaseId, id: { not: changeOrderId } },
      select: { title: true, amount: true, status: true },
    });

    const totalApproved = otherCOs
      .filter((c: any) => c.status === "APPROVED")
      .reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);

    const messages = [
      {
        role: "system" as const,
        content: `You are a construction project management AI analyzing the impact of a change order.
Return JSON: {
  "scheduleImpact": "NONE" | "MINOR" | "MODERATE" | "MAJOR",
  "budgetImpact": "NONE" | "MINOR" | "MODERATE" | "MAJOR",
  "scopeImpact": "NONE" | "MINOR" | "MODERATE" | "MAJOR",
  "overallRisk": "LOW" | "MEDIUM" | "HIGH",
  "scheduleDays": number (estimated additional days, 0 if none),
  "cumulativeBudgetEffect": number (total approved COs + this one),
  "analysis": "2-3 sentence overall impact analysis",
  "concerns": ["string array of specific concerns"],
  "recommendations": ["string array of recommendations"],
  "mitigations": ["string array of suggested mitigations"]
}`,
      },
      {
        role: "user" as const,
        content: `Project: ${project?.name || "Unknown"}, Budget: $${project?.budget || "N/A"}
Phase: ${phase?.name || "Unknown"}, Status: ${phase?.status}, Timeline: ${phase?.estStart} to ${phase?.estEnd}
Change Order: "${co.title}" — Amount: $${co.amount || 0}, Reason: ${co.reason || "N/A"}
Description: ${co.description || "N/A"}
Other COs on this phase: ${otherCOs.length} (total approved: $${totalApproved})

Analyze the schedule, budget, and scope impact of this change order.`,
      },
    ];

    const response = await callAI(messages, {
      feature: "ai_co_impact",
      userId: session.user.id,
      temperature: 0.3,
      maxTokens: 800,
    });

    const text = response.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const analysis = JSON.parse(cleaned);

    return { success: true, analysis };
  } catch (e: any) {
    return { success: false, error: e.message || "Impact analysis failed" };
  }
}

export async function generateChangeOrderDraft(
  description: string,
  projectId: string,
  phaseId?: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true, budget: true },
    });

    let phaseContext = "";
    if (phaseId) {
      const phase = await db.phase.findUnique({
        where: { id: phaseId },
        select: { name: true, status: true },
      });
      if (phase) phaseContext = `Phase: ${phase.name} (${phase.status})`;
    }

    const messages = [
      {
        role: "system" as const,
        content: `You are a construction project management AI drafting change orders.
Return JSON: {
  "title": "concise change order title",
  "description": "detailed description of the change",
  "reason": "justification for the change",
  "amount": number (estimated cost impact in dollars, positive = cost increase, negative = savings),
  "scheduleDays": number (estimated schedule impact in days),
  "category": "DESIGN_CHANGE" | "UNFORESEEN_CONDITION" | "OWNER_REQUEST" | "CODE_REQUIREMENT" | "VALUE_ENGINEERING" | "OTHER",
  "notes": "additional context or assumptions"
}`,
      },
      {
        role: "user" as const,
        content: `Project: ${project?.name || "Unknown"}, Budget: $${project?.budget || "N/A"}
${phaseContext}

Draft a change order from this description: "${description}"`,
      },
    ];

    const response = await callAI(messages, {
      feature: "ai_co_draft",
      userId: session.user.id,
      temperature: 0.4,
      maxTokens: 600,
    });

    const text = response.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const draft = JSON.parse(cleaned);

    return { success: true, draft };
  } catch (e: any) {
    return { success: false, error: e.message || "Draft generation failed" };
  }
}
