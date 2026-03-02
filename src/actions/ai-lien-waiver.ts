"use server";

/**
 * @file ai-lien-waiver.ts
 * @description AI-powered lien waiver features — Sprint 32.
 * 1. Compliance check: AI evaluates waiver completeness and legal compliance
 * 2. Payment-waiver gap analysis: AI cross-references payments vs waivers collected
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai";

const dbc = db as any;

export async function checkWaiverCompliance(
  phaseId: string,
  projectId: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const waivers = await dbc.lienWaiver.findMany({
      where: { phaseId },
      orderBy: { createdAt: "asc" },
    });

    if (waivers.length === 0) {
      return { success: false, error: "No lien waivers found for this phase" };
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true, address: true },
    });

    const phase = await db.phase.findUnique({
      where: { id: phaseId },
      select: { name: true, status: true },
    });

    const waiverSummary = waivers.map((w: any) => ({
      vendorName: w.vendorName,
      waiverType: w.waiverType,
      status: w.status,
      amount: w.amount ? Number(w.amount) : null,
      throughDate: w.throughDate,
      notarized: w.notarized,
      description: w.description,
    }));

    const messages = [
      {
        role: "system" as const,
        content: `You are a construction lien waiver compliance advisor.
Analyze the lien waivers for completeness, proper documentation, and legal compliance.
Return JSON: {
  "overallCompliance": "COMPLIANT" | "PARTIAL" | "NON_COMPLIANT",
  "complianceScore": number (1-10),
  "issues": [
    {
      "vendor": "string (vendor name)",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "issue": "string (what's wrong or missing)",
      "recommendation": "string (how to fix)"
    }
  ],
  "missingWaivers": ["string array — vendors or payment periods without waivers"],
  "typeGaps": ["string array — e.g., 'No unconditional final waivers collected'"],
  "bestPractices": ["string array of general compliance recommendations"],
  "summary": "1-2 sentence overall compliance summary"
}`,
      },
      {
        role: "user" as const,
        content: `Project: ${project?.name || "Unknown"}, Address: ${project?.address || "N/A"}
Phase: ${phase?.name || "Unknown"}, Status: ${phase?.status}
Lien Waivers (${waivers.length} total):
${waiverSummary.map((w: any) => `- ${w.vendorName}: ${w.waiverType}, Status: ${w.status}, Amount: $${w.amount || "N/A"}, Through: ${w.throughDate || "N/A"}, Notarized: ${w.notarized ? "Yes" : "No"}`).join("\n")}

Evaluate lien waiver compliance for this phase.`,
      },
    ];

    const response = await callAI(messages, {
      feature: "ai_waiver_compliance",
      userId: session.user.id,
      temperature: 0.3,
      maxTokens: 800,
    });

    const text = response.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const compliance = JSON.parse(cleaned);

    return { success: true, compliance };
  } catch (e: any) {
    return { success: false, error: e.message || "Compliance check failed" };
  }
}

export async function analyzePaymentWaiverGaps(
  phaseId: string,
  projectId: string
) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Not authenticated" };

  try {
    const [waivers, paymentApps] = await Promise.all([
      dbc.lienWaiver.findMany({
        where: { phaseId },
        orderBy: { createdAt: "asc" },
      }),
      dbc.paymentApplication.findMany({
        where: { phaseId },
        orderBy: { number: "asc" },
      }),
    ]);

    if (waivers.length === 0 && paymentApps.length === 0) {
      return { success: false, error: "No waivers or payment applications found" };
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    const phase = await db.phase.findUnique({
      where: { id: phaseId },
      select: { name: true, status: true },
    });

    const waiverSummary = waivers.map((w: any) => ({
      vendor: w.vendorName,
      type: w.waiverType,
      status: w.status,
      amount: w.amount ? Number(w.amount) : null,
      throughDate: w.throughDate,
    }));

    const paymentSummary = paymentApps.map((p: any) => ({
      number: p.number,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      workCompleted: p.workCompleted ? Number(p.workCompleted) : 0,
      currentDue: p.currentDue ? Number(p.currentDue) : 0,
      status: p.status,
    }));

    const messages = [
      {
        role: "system" as const,
        content: `You are a construction payment and lien waiver analyst.
Cross-reference payment applications against collected lien waivers to identify gaps.
Return JSON: {
  "gapSeverity": "NONE" | "MINOR" | "MODERATE" | "CRITICAL",
  "totalPayments": number (sum of all payment app amounts),
  "totalWaiversCovered": number (sum of waiver amounts),
  "uncoveredAmount": number (payments without matching waivers),
  "gaps": [
    {
      "type": "MISSING_WAIVER" | "AMOUNT_MISMATCH" | "PERIOD_GAP" | "STATUS_ISSUE",
      "description": "string (what the gap is)",
      "affectedVendor": "string (vendor name if applicable)",
      "affectedAmount": number,
      "recommendation": "string (how to resolve)"
    }
  ],
  "vendorCoverage": [
    {
      "vendor": "string",
      "paymentsMade": number,
      "waiversCollected": number,
      "hasFinalWaiver": boolean,
      "status": "COVERED" | "PARTIAL" | "UNCOVERED"
    }
  ],
  "recommendations": ["string array of prioritized actions"],
  "summary": "1-2 sentence gap analysis summary"
}`,
      },
      {
        role: "user" as const,
        content: `Project: ${project?.name || "Unknown"}
Phase: ${phase?.name || "Unknown"}, Status: ${phase?.status}

Payment Applications (${paymentApps.length}):
${paymentSummary.map((p: any) => `- #${p.number}: Period ${p.periodStart} to ${p.periodEnd}, Work: $${p.workCompleted}, Due: $${p.currentDue}, Status: ${p.status}`).join("\n")}

Lien Waivers (${waivers.length}):
${waiverSummary.map((w: any) => `- ${w.vendor}: ${w.type}, Amount: $${w.amount || "N/A"}, Status: ${w.status}, Through: ${w.throughDate || "N/A"}`).join("\n")}

Analyze the gaps between payments made and lien waivers collected.`,
      },
    ];

    const response = await callAI(messages, {
      feature: "ai_payment_waiver_gap",
      userId: session.user.id,
      temperature: 0.3,
      maxTokens: 1000,
    });

    const text = response.text || "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const gapAnalysis = JSON.parse(cleaned);

    return { success: true, gapAnalysis };
  } catch (e: any) {
    return { success: false, error: e.message || "Gap analysis failed" };
  }
}
