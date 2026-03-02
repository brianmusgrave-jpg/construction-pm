"use server";

/**
 * @file src/actions/ai-punch-list.ts
 * @description AI-powered punch list enhancements — Sprint 27.
 *
 * - Photo AI Detection: Analyze defect photos to suggest description, trade, and severity
 * - Completion Prediction: Predict closeout timeline from historical resolution rates
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai";

const dbc = db as any;

// ── Photo AI Detection ──────────────────────────────────────────────

interface PhotoAnalysisResult {
  success: boolean;
  suggestion?: {
    title: string;
    description: string;
    priority: string;
    trade: string;
    location: string;
  };
  error?: string;
}

/**
 * Analyze a punch list defect photo using AI to suggest item details.
 * Takes a photo URL (from the existing photo upload system) and returns
 * suggested punch list item fields.
 */
export async function analyzePunchListPhoto(
  photoUrl: string,
  projectId: string
): Promise<PhotoAnalysisResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const response = await callAI(
      [
        {
          role: "system",
          content: `You are a construction defect analyst. Given a description of a construction defect photo, suggest punch list item details.
Return a JSON object with these fields:
- title: Short descriptive title (e.g., "Drywall crack above door frame")
- description: Detailed description of the issue and suggested repair
- priority: One of CRITICAL, MAJOR, MINOR, or COSMETIC
- trade: The responsible trade (e.g., "Drywall", "Painting", "Plumbing", "Electrical", "HVAC", "Carpentry", "Flooring", "Roofing")
- location: Suggested location description if discernible

Return ONLY valid JSON, no markdown or explanation.`,
        },
        {
          role: "user",
          content: `Analyze this construction defect photo and suggest punch list item details. Photo URL: ${photoUrl}`,
        },
      ],
      {
        feature: "punch_list_photo_ai",
        userId: session.user.id,
        temperature: 0.3,
        maxTokens: 500,
      }
    );

    if (!response.success || !response.text) {
      return { success: false, error: response.error || "AI analysis failed" };
    }

    // Parse the JSON response
    const cleaned = response.text.replace(/```json\n?|\n?```/g, "").trim();
    const suggestion = JSON.parse(cleaned);

    return { success: true, suggestion };
  } catch (err) {
    console.error("analyzePunchListPhoto error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Photo analysis failed",
    };
  }
}

// ── Completion Prediction ───────────────────────────────────────────

interface CompletionPrediction {
  success: boolean;
  prediction?: {
    estimatedCloseoutDate: string;
    averageResolutionDays: number;
    openItemsCount: number;
    criticalBlockers: number;
    atRiskItems: number;
    confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
    insights: string[];
  };
  error?: string;
}

/**
 * Predict punch list closeout timeline based on historical resolution rates.
 * Analyzes the project's punch list data to estimate when all items will be
 * resolved, flagging items at risk of delaying CO/TCO.
 */
export async function predictPunchListCompletion(
  projectId: string
): Promise<CompletionPrediction> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Fetch all punch list items for the project
    const phases = await dbc.phase.findMany({
      where: { project: { id: projectId } },
      select: { id: true },
    });
    const phaseIds = phases.map((p: any) => p.id);

    const items = await dbc.punchListItem.findMany({
      where: { phaseId: { in: phaseIds } },
      orderBy: { createdAt: "asc" },
    });

    if (items.length === 0) {
      return {
        success: true,
        prediction: {
          estimatedCloseoutDate: new Date().toISOString(),
          averageResolutionDays: 0,
          openItemsCount: 0,
          criticalBlockers: 0,
          atRiskItems: 0,
          confidenceLevel: "HIGH",
          insights: ["No punch list items exist yet."],
        },
      };
    }

    // Calculate resolution statistics
    const now = new Date();
    const closedItems = items.filter((i: any) => i.status === "CLOSED" && i.closedAt);
    const openItems = items.filter((i: any) => i.status !== "CLOSED");
    const criticalOpen = openItems.filter((i: any) => i.priority === "CRITICAL");

    // Average resolution time for closed items
    let avgResolutionDays = 7; // default estimate
    if (closedItems.length > 0) {
      const totalDays = closedItems.reduce((sum: number, item: any) => {
        const created = new Date(item.createdAt);
        const closed = new Date(item.closedAt);
        return sum + (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      }, 0);
      avgResolutionDays = Math.round((totalDays / closedItems.length) * 10) / 10;
    }

    // Items past due
    const overdue = openItems.filter(
      (i: any) => i.dueDate && new Date(i.dueDate) < now
    );

    // Estimate closeout: open items × avg resolution time, adjusted for parallelism
    // Assume ~30% can be worked in parallel
    const parallelFactor = 0.3;
    const estimatedDaysRemaining = Math.ceil(
      openItems.length * avgResolutionDays * parallelFactor
    );
    const estimatedCloseout = new Date(
      now.getTime() + estimatedDaysRemaining * 24 * 60 * 60 * 1000
    );

    // Confidence based on data availability
    const confidenceLevel: "HIGH" | "MEDIUM" | "LOW" =
      closedItems.length >= 10 ? "HIGH" : closedItems.length >= 3 ? "MEDIUM" : "LOW";

    // Generate insights
    const insights: string[] = [];
    if (overdue.length > 0) {
      insights.push(
        `${overdue.length} item(s) are past their due date and need immediate attention.`
      );
    }
    if (criticalOpen.length > 0) {
      insights.push(
        `${criticalOpen.length} critical item(s) remain open — these may block CO/TCO.`
      );
    }
    if (avgResolutionDays > 14) {
      insights.push(
        `Average resolution time (${avgResolutionDays} days) is high. Consider adding resources.`
      );
    }
    const completionRate = items.length > 0
      ? Math.round((closedItems.length / items.length) * 100)
      : 0;
    insights.push(
      `${completionRate}% complete (${closedItems.length}/${items.length} items resolved).`
    );

    return {
      success: true,
      prediction: {
        estimatedCloseoutDate: estimatedCloseout.toISOString(),
        averageResolutionDays: avgResolutionDays,
        openItemsCount: openItems.length,
        criticalBlockers: criticalOpen.length,
        atRiskItems: overdue.length,
        confidenceLevel,
        insights,
      },
    };
  } catch (err) {
    console.error("predictPunchListCompletion error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Prediction failed",
    };
  }
}
