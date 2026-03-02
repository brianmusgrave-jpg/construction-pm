"use server";

/**
 * @file src/actions/ai-estimate.ts
 * @description AI-powered estimating enhancements — Sprint 29.
 *
 * - AI Estimate Generator: Generate takeoff line items from a scope description
 * - AI Estimate Review: Review an estimate for completeness, flag missing items
 * - Historical Cost Comparison: Compare estimate costs against similar phases
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai";

const dbc = db as any;

// ── AI Estimate Generator ──────────────────────────────────────────

interface GeneratedItem {
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  category: string;
}

interface GenerateEstimateResult {
  success: boolean;
  items?: GeneratedItem[];
  totalEstimate?: number;
  confidence?: string;
  notes?: string;
  error?: string;
}

/**
 * Generate takeoff line items from a scope description using AI.
 * Returns suggested items with quantities, units, and unit costs.
 */
export async function generateEstimateFromScope(
  scopeDescription: string,
  projectId: string,
  phaseType?: string
): Promise<GenerateEstimateResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Fetch project context for better estimates
    let projectContext = "";
    try {
      const project = await dbc.project.findUnique({
        where: { id: projectId },
        select: { name: true, type: true, location: true, budget: true },
      });
      if (project) {
        projectContext = `Project: ${project.name}. Type: ${project.type || "Unknown"}. Location: ${project.location || "Unknown"}. Budget: $${project.budget ? Number(project.budget).toLocaleString() : "Not set"}.`;
      }
    } catch {
      // Continue without project context
    }

    const response = await callAI(
      [
        {
          role: "system",
          content: `You are an expert construction estimator. Given a scope of work description, generate detailed takeoff line items with realistic quantities, units, and unit costs based on 2025 US construction pricing.

${projectContext ? `Context: ${projectContext}` : ""}
${phaseType ? `Phase type: ${phaseType}` : ""}

Return a JSON object with:
- items: Array of objects with: description, quantity (number), unit (e.g. "SF", "LF", "EA", "CY", "HR"), unitCost (number, USD), totalCost (quantity × unitCost), category (one of: "Labor", "Materials", "Equipment", "Subcontractor", "Overhead")
- totalEstimate: Sum of all item totalCost values
- confidence: "HIGH", "MEDIUM", or "LOW" based on how specific the scope description is
- notes: Brief notes about assumptions or items that need clarification

Return ONLY valid JSON, no markdown or explanation. Generate between 5-15 line items as appropriate for the scope.`,
        },
        {
          role: "user",
          content: `Generate a construction estimate for this scope of work:\n\n${scopeDescription}`,
        },
      ],
      {
        feature: "ai_estimate_generator",
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
      items: result.items || [],
      totalEstimate: result.totalEstimate || 0,
      confidence: result.confidence || "MEDIUM",
      notes: result.notes || "",
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to generate estimate" };
  }
}

// ── AI Estimate Review ─────────────────────────────────────────────

interface ReviewResult {
  success: boolean;
  review?: {
    completeness: string; // HIGH, MEDIUM, LOW
    missingItems: string[];
    concerns: string[];
    suggestions: string[];
    costAssessment: string;
    overallScore: number; // 1-10
  };
  error?: string;
}

/**
 * Review an existing estimate for completeness and accuracy.
 * Flags missing line items, cost concerns, and suggests improvements.
 */
export async function reviewEstimate(
  estimateId: string,
  projectId: string
): Promise<ReviewResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Fetch the estimate with all items
    const estimate = await dbc.estimate.findUnique({
      where: { id: estimateId },
      include: {
        items: true,
        phase: { select: { name: true, type: true } },
      },
    });

    if (!estimate) {
      return { success: false, error: "Estimate not found" };
    }

    const itemsList = estimate.items
      .map(
        (i: any) =>
          `- ${i.description}: ${Number(i.quantity)} ${i.unit} × $${Number(i.unitCost)} = $${Number(i.totalCost)} [${i.category || "Uncategorized"}]`
      )
      .join("\n");

    const response = await callAI(
      [
        {
          role: "system",
          content: `You are a senior construction estimating reviewer. Analyze this estimate for completeness, accuracy, and potential issues.

Return a JSON object with:
- completeness: "HIGH", "MEDIUM", or "LOW" — how complete the estimate appears
- missingItems: Array of string descriptions of likely missing line items
- concerns: Array of string descriptions of cost or quantity concerns
- suggestions: Array of actionable improvement suggestions
- costAssessment: Brief paragraph about overall cost reasonableness for 2025 US pricing
- overallScore: Integer 1-10 rating of the estimate quality

Return ONLY valid JSON, no markdown or explanation.`,
        },
        {
          role: "user",
          content: `Review this construction estimate:

Estimate: "${estimate.name}"
${estimate.description ? `Description: ${estimate.description}` : ""}
Phase: ${estimate.phase?.name || "Unknown"} (${estimate.phase?.type || "Unknown"})
Total: $${Number(estimate.totalCost).toLocaleString()}
Status: ${estimate.status}

Line Items (${estimate.items.length}):
${itemsList || "No items yet"}`,
        },
      ],
      {
        feature: "ai_estimate_review",
        userId: session.user.id,
        temperature: 0.3,
        maxTokens: 1500,
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
        completeness: review.completeness || "MEDIUM",
        missingItems: review.missingItems || [],
        concerns: review.concerns || [],
        suggestions: review.suggestions || [],
        costAssessment: review.costAssessment || "",
        overallScore: review.overallScore || 5,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to review estimate" };
  }
}

// ── Historical Cost Comparison ─────────────────────────────────────

interface ComparisonResult {
  success: boolean;
  comparison?: {
    currentTotal: number;
    historicalAvg: number;
    historicalMin: number;
    historicalMax: number;
    comparedPhases: number;
    percentDiff: number;
    assessment: string; // BELOW_AVERAGE, ON_TARGET, ABOVE_AVERAGE
    insights: string[];
  };
  error?: string;
}

/**
 * Compare an estimate's costs against historical data from similar phases.
 * Uses past approved estimates to provide context on pricing.
 */
export async function compareEstimateHistorical(
  estimateId: string,
  projectId: string
): Promise<ComparisonResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Fetch current estimate
    const estimate = await dbc.estimate.findUnique({
      where: { id: estimateId },
      include: {
        phase: { select: { name: true, type: true } },
      },
    });

    if (!estimate) {
      return { success: false, error: "Estimate not found" };
    }

    const currentTotal = Number(estimate.totalCost);

    // Find historical estimates from other phases (approved/final status preferred)
    let historicalEstimates: any[] = [];
    try {
      historicalEstimates = await dbc.estimate.findMany({
        where: {
          id: { not: estimateId },
          status: { in: ["APPROVED", "FINAL"] },
        },
        select: {
          totalCost: true,
          name: true,
          phase: { select: { name: true, type: true } },
        },
        take: 50,
      });
    } catch {
      // Continue with empty historical data
    }

    if (historicalEstimates.length === 0) {
      return {
        success: true,
        comparison: {
          currentTotal,
          historicalAvg: 0,
          historicalMin: 0,
          historicalMax: 0,
          comparedPhases: 0,
          percentDiff: 0,
          assessment: "ON_TARGET",
          insights: ["No historical estimates available for comparison. This is the first estimate in the system."],
        },
      };
    }

    const totals = historicalEstimates.map((e: any) => Number(e.totalCost));
    const historicalAvg = totals.reduce((a: number, b: number) => a + b, 0) / totals.length;
    const historicalMin = Math.min(...totals);
    const historicalMax = Math.max(...totals);
    const percentDiff = historicalAvg > 0 ? ((currentTotal - historicalAvg) / historicalAvg) * 100 : 0;

    let assessment = "ON_TARGET";
    if (percentDiff < -15) assessment = "BELOW_AVERAGE";
    else if (percentDiff > 15) assessment = "ABOVE_AVERAGE";

    const insights: string[] = [];
    if (percentDiff > 25) {
      insights.push(`This estimate is ${Math.round(percentDiff)}% above the historical average — verify scope additions or pricing escalation.`);
    } else if (percentDiff < -25) {
      insights.push(`This estimate is ${Math.round(Math.abs(percentDiff))}% below the historical average — check for missing line items.`);
    } else {
      insights.push(`This estimate is within normal range (${Math.round(percentDiff)}% vs. average).`);
    }

    if (currentTotal > historicalMax) {
      insights.push(`This is the highest estimate in the system ($${currentTotal.toLocaleString()} vs. previous max $${historicalMax.toLocaleString()}).`);
    }
    if (currentTotal < historicalMin && currentTotal > 0) {
      insights.push(`This is the lowest estimate in the system ($${currentTotal.toLocaleString()} vs. previous min $${historicalMin.toLocaleString()}).`);
    }

    insights.push(`Compared against ${historicalEstimates.length} historical estimates.`);

    return {
      success: true,
      comparison: {
        currentTotal,
        historicalAvg: Math.round(historicalAvg),
        historicalMin,
        historicalMax,
        comparedPhases: historicalEstimates.length,
        percentDiff: Math.round(percentDiff * 10) / 10,
        assessment,
        insights,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to compare estimates" };
  }
}
