"use server";

/**
 * @file src/actions/ai-submittal.ts
 * @description AI-powered submittal enhancements — Sprint 30.
 *
 * - AI Submittal Completeness Check: Review a submittal for completeness
 * - AI Submittal Package Generator: Generate required submittals for a spec section
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai";

const dbc = db as any;

// ── AI Submittal Completeness Check ──────────────────────────────────

interface CompletenessResult {
  success: boolean;
  review?: {
    score: number;
    status: string;
    missingElements: string[];
    concerns: string[];
    recommendations: string[];
    specCompliance: string;
  };
  error?: string;
}

/**
 * Review a submittal for completeness, checking spec alignment,
 * required documentation, and suggesting improvements.
 */
export async function checkSubmittalCompleteness(
  submittalId: string,
  projectId: string
): Promise<CompletenessResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const submittal = await dbc.submittal.findUnique({
      where: { id: submittalId },
      include: {
        phase: { select: { name: true, type: true } },
      },
    });

    if (!submittal) {
      return { success: false, error: "Submittal not found" };
    }

    const response = await callAI(
      [
        {
          role: "system",
          content: `You are a construction submittal review specialist. Evaluate this submittal for completeness and compliance with construction industry standards.

Return a JSON object with:
- score: Integer 1-10 rating of submittal completeness
- status: "COMPLETE", "NEEDS_REVISION", or "INCOMPLETE"
- missingElements: Array of items typically required for this type of submittal that appear to be missing (e.g., "Product data sheets", "Shop drawings", "Material safety data sheets", "Warranty information", "Color samples")
- concerns: Array of potential issues with the submittal (e.g., "No spec section reference provided", "Title is too vague for tracking")
- recommendations: Array of actionable suggestions to improve the submittal before review
- specCompliance: Brief assessment of how well the submittal aligns with the referenced spec section (if provided)

Return ONLY valid JSON, no markdown or explanation.`,
        },
        {
          role: "user",
          content: `Review this construction submittal for completeness:

Submittal #${submittal.submittalNumber}: "${submittal.title}"
${submittal.specSection ? `Spec Section: ${submittal.specSection}` : "No spec section referenced"}
${submittal.description ? `Description: ${submittal.description}` : "No description provided"}
Phase: ${submittal.phase?.name || "Unknown"} (${submittal.phase?.type || "Unknown"})
Revision: ${submittal.revision}
Status: ${submittal.status}`,
        },
      ],
      {
        feature: "ai_submittal_review",
        userId: session.user.id,
        temperature: 0.3,
        maxTokens: 1000,
      }
    );

    if (!response.success || !response.text) {
      return { success: false, error: response.error || "AI review failed" };
    }

    const cleaned = response.text.replace(/```json\n?|\n?```/g, "").trim();
    const review = JSON.parse(cleaned);

    return {
      success: true,
      review: {
        score: review.score || 5,
        status: review.status || "NEEDS_REVISION",
        missingElements: review.missingElements || [],
        concerns: review.concerns || [],
        recommendations: review.recommendations || [],
        specCompliance: review.specCompliance || "",
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to review submittal" };
  }
}

// ── AI Submittal Package Generator ───────────────────────────────────

interface SubmittalPackageResult {
  success: boolean;
  package?: {
    items: {
      title: string;
      specSection: string;
      description: string;
      requiredDocs: string[];
      priority: string;
    }[];
    totalItems: number;
    notes: string;
  };
  error?: string;
}

/**
 * Generate a list of required submittals for a given spec section or scope.
 * Helps PMs create comprehensive submittal logs upfront.
 */
export async function generateSubmittalPackage(
  scopeDescription: string,
  projectId: string,
  phaseId?: string
): Promise<SubmittalPackageResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    let context = "";
    try {
      const project = await dbc.project.findUnique({
        where: { id: projectId },
        select: { name: true, type: true },
      });
      if (project) {
        context += `Project: ${project.name}. Type: ${project.type || "Unknown"}.`;
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
          content: `You are a construction submittal coordinator. Given a scope of work or spec section description, generate a comprehensive list of submittals that would typically be required.

${context ? `Context: ${context}` : ""}

Return a JSON object with:
- items: Array of objects with:
  - title: Descriptive submittal title (e.g., "Concrete Mix Design — 4000 PSI")
  - specSection: Relevant CSI MasterFormat spec section (e.g., "03 30 00 — Cast-in-Place Concrete")
  - description: Brief description of what should be included in this submittal
  - requiredDocs: Array of document types needed (e.g., "Product data", "Shop drawings", "Samples", "Certifications")
  - priority: "HIGH", "MEDIUM", or "LOW" based on lead time and critical path impact
- totalItems: Count of items generated
- notes: Any notes about the submittal package or items that may need additional clarification

Generate between 3-12 submittals as appropriate for the scope. Return ONLY valid JSON.`,
        },
        {
          role: "user",
          content: `Generate a submittal package for this scope:\n\n${scopeDescription}`,
        },
      ],
      {
        feature: "ai_submittal_package",
        userId: session.user.id,
        temperature: 0.3,
        maxTokens: 2000,
      }
    );

    if (!response.success || !response.text) {
      return { success: false, error: response.error || "AI generation failed" };
    }

    const cleaned = response.text.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(cleaned);

    return {
      success: true,
      package: {
        items: result.items || [],
        totalItems: result.totalItems || (result.items?.length ?? 0),
        notes: result.notes || "",
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to generate submittal package" };
  }
}
