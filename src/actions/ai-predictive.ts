"use server";

/**
 * @file src/actions/ai-predictive.ts
 * @description AI Predictive Analytics — Sprint 34.
 *
 * Phase 4 of the AI Strategy Roadmap — transforms Construction PM from a
 * reactive tracking tool into a proactive prediction engine.
 *
 * - Schedule Risk Prediction: Predict which phases are at risk of delay
 * - Budget Forecasting: Predict final project costs with confidence intervals
 * - Change Order Pattern Detection: Flag anomalous CO frequency / magnitude
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai";

const dbc = db as any;

// ── Schedule Risk Prediction ──────────────────────────────────────────

interface ScheduleRiskResult {
  success: boolean;
  prediction?: {
    overallRisk: string;
    riskScore: number;
    atRiskPhases: {
      phaseName: string;
      currentProgress: number;
      expectedProgress: number;
      daysRemaining: number;
      riskLevel: string;
      riskFactors: string[];
      suggestedAction: string;
    }[];
    criticalPath: string[];
    recommendations: string[];
  };
  error?: string;
}

/**
 * Analyze all phases in a project to predict schedule risks.
 * Uses phase dates, progress, dependencies, and historical patterns.
 */
export async function predictScheduleRisks(
  projectId: string
): Promise<ScheduleRiskResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const phases = await db.phase.findMany({
      where: { projectId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        progress: true,
        estStart: true,
        estEnd: true,
        isMilestone: true,
      },
    });

    if (phases.length === 0) {
      return { success: false, error: "No phases found" };
    }

    // Fetch dependencies for dependency chain analysis
    const deps = await dbc.phaseDependency.findMany({
      where: { phase: { projectId } },
      select: {
        phaseId: true,
        dependsOnId: true,
        lagDays: true,
      },
    });

    const today = new Date().toISOString().split("T")[0];

    const phaseData = phases.map((p: any) => ({
      name: p.name,
      status: p.status,
      progress: p.progress,
      estStart: p.estStart ? p.estStart.toISOString().split("T")[0] : null,
      estEnd: p.estEnd ? p.estEnd.toISOString().split("T")[0] : null,
      isMilestone: p.isMilestone,
    }));

    const depData = deps.map((d: any) => {
      const from = phases.find((p: any) => p.id === d.dependsOnId);
      const to = phases.find((p: any) => p.id === d.phaseId);
      return {
        from: from?.name || "Unknown",
        to: to?.name || "Unknown",
        lagDays: d.lagDays,
      };
    });

    const response = await callAI(
      [
        {
          role: "system",
          content: `You are a construction schedule risk analyst. Analyze the project phases, their progress, dates, and dependencies to predict schedule risks.

Today's date: ${today}

Return a JSON object with:
- overallRisk: "LOW", "MODERATE", "HIGH", or "CRITICAL"
- riskScore: Integer 1-10 (10 = highest risk)
- atRiskPhases: Array of phases with potential delays, each with:
  - phaseName: Name of the at-risk phase
  - currentProgress: Actual progress percentage
  - expectedProgress: Where progress should be based on elapsed time
  - daysRemaining: Calendar days until estimated end
  - riskLevel: "LOW", "MODERATE", "HIGH", or "CRITICAL"
  - riskFactors: Array of specific risk factors
  - suggestedAction: One actionable recommendation
- criticalPath: Array of phase names forming the critical path
- recommendations: Array of 3-5 project-level schedule recommendations

Return ONLY valid JSON, no markdown.`,
        },
        {
          role: "user",
          content: `Analyze schedule risks for this project:

Phases:
${JSON.stringify(phaseData, null, 2)}

Dependencies:
${JSON.stringify(depData, null, 2)}`,
        },
      ],
      {
        feature: "ai_schedule_risk",
        userId: session.user.id,
        temperature: 0.3,
        maxTokens: 2000,
      }
    );

    if (!response.success || !response.text) {
      return { success: false, error: response.error || "AI analysis failed" };
    }

    const text = response.text || "";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(cleaned);

    return {
      success: true,
      prediction: {
        overallRisk: result.overallRisk || "MODERATE",
        riskScore: result.riskScore || 5,
        atRiskPhases: result.atRiskPhases || [],
        criticalPath: result.criticalPath || [],
        recommendations: result.recommendations || [],
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to predict schedule risks" };
  }
}

// ── Budget Forecasting ────────────────────────────────────────────────

interface BudgetForecastResult {
  success: boolean;
  forecast?: {
    projectedFinalCost: string;
    confidenceLevel: string;
    costVariance: string;
    forecastAccuracy: string;
    categoryBreakdown: {
      category: string;
      budgeted: number;
      spent: number;
      projected: number;
      variance: string;
      trend: string;
    }[];
    changeOrderImpact: {
      totalCOs: number;
      totalAmount: string;
      pattern: string;
      riskLevel: string;
    };
    cashFlowProjection: {
      period: string;
      projected: string;
      note: string;
    }[];
    recommendations: string[];
  };
  error?: string;
}

/**
 * Forecast final project cost using budget data, change orders, and spending trends.
 */
export async function forecastBudget(
  projectId: string
): Promise<BudgetForecastResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Fetch project with budget info
    const project = await dbc.project.findUnique({
      where: { id: projectId },
      select: { name: true, budget: true, type: true },
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    // Fetch phases with budget data
    const phases = await dbc.phase.findMany({
      where: { projectId },
      select: {
        name: true,
        status: true,
        progress: true,
        budgetEstimate: true,
        budgetActual: true,
      },
    });

    // Fetch change orders
    let changeOrders: any[] = [];
    try {
      changeOrders = await dbc.changeOrder.findMany({
        where: { phase: { projectId } },
        select: {
          title: true,
          amount: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });
      changeOrders = changeOrders.map((co: any) => ({
        ...co,
        amount: co.amount ? Number(co.amount) : 0,
      }));
    } catch {
      // Continue without change orders
    }

    // Fetch payment applications for spend tracking
    let payApps: any[] = [];
    try {
      payApps = await dbc.paymentApplication.findMany({
        where: { phase: { projectId } },
        select: {
          applicationNumber: true,
          currentDue: true,
          scheduledValue: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });
      payApps = payApps.map((pa: any) => ({
        ...pa,
        currentDue: pa.currentDue ? Number(pa.currentDue) : 0,
        scheduledValue: pa.scheduledValue ? Number(pa.scheduledValue) : 0,
      }));
    } catch {
      // Continue without pay apps
    }

    const budgetData = phases.map((p: any) => ({
      phase: p.name,
      status: p.status,
      progress: p.progress,
      estimated: p.budgetEstimate ? Number(p.budgetEstimate) : null,
      actual: p.budgetActual ? Number(p.budgetActual) : null,
    }));

    const coData = changeOrders.map((co: any) => ({
      title: co.title,
      amount: co.amount,
      status: co.status,
      date: co.createdAt?.toISOString().split("T")[0],
    }));

    const response = await callAI(
      [
        {
          role: "system",
          content: `You are a construction cost analyst. Analyze project budget data, change orders, and spending patterns to forecast the final project cost.

Return a JSON object with:
- projectedFinalCost: String like "$1,250,000" — estimated total cost at completion
- confidenceLevel: "HIGH", "MODERATE", or "LOW"
- costVariance: String like "+$50,000 (4.2% over)" or "-$20,000 (1.6% under)"
- forecastAccuracy: Brief note on data quality affecting forecast reliability
- categoryBreakdown: Array of cost categories with budgeted, spent, projected amounts and variance/trend
- changeOrderImpact: Object with totalCOs count, totalAmount string, pattern description, and riskLevel
- cashFlowProjection: Array of 3-6 upcoming periods with projected spend and notes
- recommendations: Array of 3-5 actionable cost management recommendations

Return ONLY valid JSON, no markdown.`,
        },
        {
          role: "user",
          content: `Forecast the budget for this project:

Project: ${project.name}
Type: ${project.type || "Unknown"}
Overall Budget: ${project.budget ? `$${Number(project.budget).toLocaleString()}` : "Not set"}

Phase Budget Data:
${JSON.stringify(budgetData, null, 2)}

Change Orders (${changeOrders.length} total):
${JSON.stringify(coData, null, 2)}

Payment Applications (${payApps.length} total):
${payApps.length > 0 ? `Total billed: $${payApps.reduce((s: number, p: any) => s + p.currentDue, 0).toLocaleString()}` : "None yet"}`,
        },
      ],
      {
        feature: "ai_budget_forecast",
        userId: session.user.id,
        temperature: 0.3,
        maxTokens: 2000,
      }
    );

    if (!response.success || !response.text) {
      return { success: false, error: response.error || "AI forecast failed" };
    }

    const text = response.text || "";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const result = JSON.parse(cleaned);

    return {
      success: true,
      forecast: {
        projectedFinalCost: result.projectedFinalCost || "Unknown",
        confidenceLevel: result.confidenceLevel || "LOW",
        costVariance: result.costVariance || "Unknown",
        forecastAccuracy: result.forecastAccuracy || "",
        categoryBreakdown: result.categoryBreakdown || [],
        changeOrderImpact: result.changeOrderImpact || {
          totalCOs: 0,
          totalAmount: "$0",
          pattern: "No data",
          riskLevel: "LOW",
        },
        cashFlowProjection: result.cashFlowProjection || [],
        recommendations: result.recommendations || [],
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to forecast budget" };
  }
}
