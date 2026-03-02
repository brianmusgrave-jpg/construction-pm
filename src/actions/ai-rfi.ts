"use server";

/**
 * @file src/actions/ai-rfi.ts
 * @description AI-powered RFI enhancements — Sprint 30.
 *
 * - AI RFI Draft Generator: Generate a properly formatted RFI from a description
 * - AI RFI Response Suggestion: Suggest an answer for an open RFI based on context
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai";

const dbc = db as any;

// ── AI RFI Draft Generator ───────────────────────────────────────────

interface DraftRFIResult {
  success: boolean;
  draft?: {
    subject: string;
    question: string;
    priority: string;
    ballInCourt: string;
    context: string;
  };
  error?: string;
}

/**
 * Generate a properly formatted RFI draft from a description of the issue.
 * Returns a suggested subject, question body, priority, and ball-in-court.
 */
export async function generateRFIDraft(
  description: string,
  projectId: string,
  phaseId?: string
): Promise<DraftRFIResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Fetch project + phase context
    let context = "";
    try {
      const project = await dbc.project.findUnique({
        where: { id: projectId },
        select: { name: true, type: true, location: true },
      });
      if (project) {
        context += `Project: ${project.name}. Type: ${project.type || "Unknown"}. Location: ${project.location || "Unknown"}.`;
      }
      if (phaseId) {
        const phase = await db.phase.findUnique({
          where: { id: phaseId },
          select: { name: true, type: true },
        });
        if (phase) {
          context += ` Phase: ${phase.name} (${phase.type || "General"}).`;
        }
      }
    } catch {
      // Continue without context
    }

    const response = await callAI(
      [
        {
          role: "system",
          content: `You are an expert construction project coordinator specializing in RFI (Request for Information) management. Given an informal description of an issue or question, generate a professionally formatted RFI draft.

${context ? `Context: ${context}` : ""}

Return a JSON object with:
- subject: Concise, professional subject line (max 80 chars, e.g. "Clarification on Foundation Rebar Spacing per DWG S-101")
- question: Formal, detailed question body that clearly states what information is needed, references relevant drawings/specs if mentioned, and explains the impact of not getting clarification
- priority: One of "LOW", "NORMAL", "HIGH", or "URGENT" based on the apparent urgency
- ballInCourt: Who should answer this — typically "Architect", "Engineer", "Owner", "GC", or a specific trade
- context: Brief note about why this RFI is needed and what's at stake

Return ONLY valid JSON, no markdown or explanation.`,
        },
        {
          role: "user",
          content: `Generate an RFI draft for this issue:\n\n${description}`,
        },
      ],
      {
        feature: "ai_rfi_draft",
        userId: session.user.id,
        temperature: 0.3,
        maxTokens: 800,
      }
    );

    if (!response.success || !response.text) {
      return { success: false, error: response.error || "AI generation failed" };
    }

    const cleaned = response.text.replace(/```json\n?|\n?```/g, "").trim();
    const draft = JSON.parse(cleaned);

    return {
      success: true,
      draft: {
        subject: draft.subject || "",
        question: draft.question || "",
        priority: draft.priority || "NORMAL",
        ballInCourt: draft.ballInCourt || "Architect",
        context: draft.context || "",
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to generate RFI draft" };
  }
}

// ── AI RFI Response Suggestion ────────────────────────────────────────

interface SuggestResponseResult {
  success: boolean;
  suggestion?: {
    answer: string;
    confidence: string;
    references: string[];
    caveats: string[];
  };
  error?: string;
}

/**
 * Suggest an answer for an open RFI based on project context and similar past RFIs.
 * Helps reviewers draft responses faster.
 */
export async function suggestRFIResponse(
  rfiId: string,
  projectId: string
): Promise<SuggestResponseResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Fetch the RFI
    const rfi = await dbc.rFI.findUnique({
      where: { id: rfiId },
      include: {
        phase: { select: { name: true, type: true } },
      },
    });

    if (!rfi) {
      return { success: false, error: "RFI not found" };
    }

    // Fetch past answered RFIs for context
    let pastRFIs: any[] = [];
    try {
      pastRFIs = await dbc.rFI.findMany({
        where: {
          id: { not: rfiId },
          status: { in: ["ANSWERED", "CLOSED"] },
          answer: { not: null },
        },
        select: { subject: true, question: true, answer: true },
        take: 10,
        orderBy: { answeredAt: "desc" },
      });
    } catch {
      // Continue without historical context
    }

    const pastContext = pastRFIs.length > 0
      ? `\n\nPreviously answered RFIs for reference:\n${pastRFIs.map((r: any) => `Q: ${r.subject} — ${r.question}\nA: ${r.answer}`).join("\n\n")}`
      : "";

    const response = await callAI(
      [
        {
          role: "system",
          content: `You are a senior construction project manager helping draft RFI responses. Given an RFI question, suggest a professional response based on construction best practices and any available context.

Return a JSON object with:
- answer: A professional, detailed response that directly addresses the question. Reference industry standards (ACI, ASTM, NEC, IBC) when applicable.
- confidence: "HIGH", "MEDIUM", or "LOW" based on how specific the question is and whether you have enough context
- references: Array of relevant standards, codes, or document references that support the answer
- caveats: Array of disclaimers or items that should be verified before finalizing the response

Return ONLY valid JSON, no markdown or explanation.`,
        },
        {
          role: "user",
          content: `Suggest a response for this RFI:

Subject: "${rfi.subject}"
Question: "${rfi.question}"
Phase: ${rfi.phase?.name || "Unknown"} (${rfi.phase?.type || "Unknown"})
Priority: ${rfi.priority}${pastContext}`,
        },
      ],
      {
        feature: "ai_rfi_response",
        userId: session.user.id,
        temperature: 0.3,
        maxTokens: 1200,
      }
    );

    if (!response.success || !response.text) {
      return { success: false, error: response.error || "AI suggestion failed" };
    }

    const cleaned = response.text.replace(/```json\n?|\n?```/g, "").trim();
    const suggestion = JSON.parse(cleaned);

    return {
      success: true,
      suggestion: {
        answer: suggestion.answer || "",
        confidence: suggestion.confidence || "MEDIUM",
        references: suggestion.references || [],
        caveats: suggestion.caveats || [],
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to suggest response" };
  }
}
