"use server";

/**
 * @file actions/ai-insights.ts
 * @description Sprint 23 — AI Proactive Insights (#75–#81).
 *
 * #75 AI Weekly Stakeholder Update — auto-generate weekly progress summaries
 * #76 AI Meeting Prep Brief — pre-meeting intelligence with status, risks, action items
 * #77 Multi-Project Morning Digest — daily digest across all user's projects
 * #78 Schedule Risk Scoring — AI-predicted schedule risk per phase
 * #79 Budget Trend Prediction — spend trajectory + forecast
 * #80 Weather Impact Forecasting — weather-based schedule impact
 * #81 Change Order Pattern Detection — pattern recognition in change orders
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { callAI } from "@/lib/ai";

// ── #75 AI Weekly Stakeholder Update ─────────────────────────────────────

export interface StakeholderUpdate {
  summary: string;
  highlights: string[];
  risks: string[];
  nextWeekPriorities: string[];
  metrics: {
    phasesCompleted: number;
    phasesInProgress: number;
    budgetSpent: string;
    overallProgress: string;
  };
}

/**
 * Generate a weekly stakeholder update report for a project.
 * Synthesises the last 7 days of activity, phase changes, budget data,
 * and milestones into a professional stakeholder summary.
 */
export async function generateStakeholderUpdate(
  projectId: string
): Promise<StakeholderUpdate> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const dbc = db as any;
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  // Gather project data
  const [project, phases, activities, changeOrders] = await Promise.all([
    dbc.project.findUnique({
      where: { id: projectId },
      select: { name: true, budget: true, status: true, startDate: true, endDate: true, address: true },
    }),
    dbc.phase.findMany({
      where: { projectId },
      select: { name: true, status: true, progress: true, estStart: true, estEnd: true, budget: true, actualCost: true },
      orderBy: { sortOrder: "asc" },
    }),
    dbc.activityLog.findMany({
      where: { projectId, createdAt: { gte: weekAgo } },
      select: { action: true, message: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    dbc.changeOrder.findMany({
      where: { phase: { projectId }, createdAt: { gte: weekAgo } },
      select: { title: true, status: true, amount: true },
    }).catch(() => []),
  ]);

  if (!project) throw new Error("Project not found");

  const completed = phases.filter((p: any) => p.status === "COMPLETE").length;
  const inProgress = phases.filter((p: any) => p.status === "IN_PROGRESS").length;
  const totalBudget = project.budget || 0;
  const totalSpent = phases.reduce((s: number, p: any) => s + (p.actualCost || 0), 0);

  const context = [
    `Project: "${project.name}" (${project.status})`,
    `Address: ${project.address || "N/A"}`,
    `Budget: $${totalBudget.toLocaleString()} | Spent: $${totalSpent.toLocaleString()}`,
    `Phases: ${completed}/${phases.length} complete, ${inProgress} in progress`,
    `\n## Phase Status`,
    ...phases.map((p: any) => `- ${p.name}: ${p.status} (${p.progress || 0}% complete)`),
    `\n## This Week's Activity (${activities.length} events)`,
    ...activities.slice(0, 15).map((a: any) => `- ${a.message}`),
    changeOrders.length > 0 ? `\n## Change Orders This Week: ${changeOrders.length}` : "",
    ...changeOrders.map((co: any) => `- ${co.title}: ${co.status} ($${co.amount || 0})`),
  ].filter(Boolean).join("\n");

  const result = await callAI(
    [
      {
        role: "system",
        content:
          `You are a construction project manager writing a weekly stakeholder update. ` +
          `Generate a professional, concise report suitable for project owners and investors.\n\n` +
          `Return ONLY valid JSON:\n` +
          `{"summary": "2-3 sentence executive summary", "highlights": ["achievement 1", ...], ` +
          `"risks": ["risk 1", ...], "nextWeekPriorities": ["priority 1", ...], ` +
          `"metrics": {"phasesCompleted": N, "phasesInProgress": N, "budgetSpent": "$X / $Y", "overallProgress": "X%"}}`,
      },
      { role: "user", content: context },
    ],
    { maxTokens: 1024, temperature: 0.3, feature: "stakeholder_update", userId: session.user.id }
  );

  if (!result.success || !result.text) throw new Error(`Stakeholder update failed: ${result.error}`);

  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      summary: result.text.slice(0, 500),
      highlights: [],
      risks: [],
      nextWeekPriorities: [],
      metrics: { phasesCompleted: completed, phasesInProgress: inProgress, budgetSpent: `$${totalSpent}`, overallProgress: `${Math.round((completed / (phases.length || 1)) * 100)}%` },
    };
  }
}

// ── #76 AI Meeting Prep Brief ────────────────────────────────────────────

export interface MeetingPrepBrief {
  projectSnapshot: string;
  keyDecisionsNeeded: string[];
  openIssues: string[];
  recentChanges: string[];
  talkingPoints: string[];
  suggestedAgenda: string[];
}

/**
 * Generate a meeting prep brief for a project.
 * Pulls project status, open issues, pending decisions, and recent changes
 * to create an actionable brief for the meeting organizer.
 */
export async function generateMeetingPrepBrief(
  projectId: string
): Promise<MeetingPrepBrief> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const dbc = db as any;
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [project, phases, activities, punchLists, rfis] = await Promise.all([
    dbc.project.findUnique({
      where: { id: projectId },
      select: { name: true, budget: true, status: true, address: true },
    }),
    dbc.phase.findMany({
      where: { projectId },
      select: { name: true, status: true, progress: true, estEnd: true, budget: true, actualCost: true },
    }),
    dbc.activityLog.findMany({
      where: { projectId, createdAt: { gte: weekAgo } },
      select: { message: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    dbc.punchListItem.findMany({
      where: { phase: { projectId }, status: { not: "RESOLVED" } },
      select: { title: true, priority: true, status: true },
      take: 10,
    }).catch(() => []),
    dbc.rfi.findMany({
      where: { phase: { projectId }, status: { not: "CLOSED" } },
      select: { subject: true, status: true },
      take: 10,
    }).catch(() => []),
  ]);

  if (!project) throw new Error("Project not found");

  const overdue = phases.filter((p: any) => p.status !== "COMPLETE" && new Date(p.estEnd) < new Date());

  const context = [
    `Project: "${project.name}" — ${project.status}`,
    `\n## Phases:`,
    ...phases.map((p: any) => `- ${p.name}: ${p.status}, ${p.progress || 0}% complete${new Date(p.estEnd) < new Date() && p.status !== "COMPLETE" ? " ⚠ OVERDUE" : ""}`),
    overdue.length > 0 ? `\n## Overdue Items: ${overdue.length} phases behind schedule` : "",
    punchLists.length > 0 ? `\n## Open Punch List Items: ${punchLists.length}` : "",
    ...punchLists.map((pl: any) => `- [${pl.priority}] ${pl.title} (${pl.status})`),
    rfis.length > 0 ? `\n## Open RFIs: ${rfis.length}` : "",
    ...rfis.map((r: any) => `- ${r.subject} (${r.status})`),
    `\n## Recent Activity:`,
    ...activities.map((a: any) => `- ${a.message}`),
  ].filter(Boolean).join("\n");

  const result = await callAI(
    [
      {
        role: "system",
        content:
          `You are a construction PM preparing a meeting brief. Generate an actionable prep document.\n\n` +
          `Return ONLY valid JSON:\n` +
          `{"projectSnapshot": "2-sentence status summary", "keyDecisionsNeeded": ["decision 1", ...], ` +
          `"openIssues": ["issue 1", ...], "recentChanges": ["change 1", ...], ` +
          `"talkingPoints": ["point 1", ...], "suggestedAgenda": ["agenda item 1", ...]}`,
      },
      { role: "user", content: context },
    ],
    { maxTokens: 1024, temperature: 0.3, feature: "meeting_prep", userId: session.user.id }
  );

  if (!result.success || !result.text) throw new Error(`Meeting prep failed: ${result.error}`);

  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      projectSnapshot: result.text.slice(0, 300),
      keyDecisionsNeeded: [],
      openIssues: [],
      recentChanges: [],
      talkingPoints: [],
      suggestedAgenda: [],
    };
  }
}

// ── #77 Multi-Project Morning Digest ─────────────────────────────────────

export interface MorningDigest {
  greeting: string;
  projectSummaries: Array<{
    projectName: string;
    status: string;
    topPriority: string;
    alertLevel: "green" | "yellow" | "red";
  }>;
  todaysPriorities: string[];
  alertsAndRisks: string[];
  overallSummary: string;
}

/**
 * Generate a morning digest across all the user's projects.
 * Provides a cross-project overview to start the day.
 */
export async function generateMorningDigest(): Promise<MorningDigest> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const dbc = db as any;
  const yesterday = new Date(Date.now() - 24 * 3600000);

  const projects = await dbc.project.findMany({
    where: { members: { some: { userId: session.user.id } }, status: { not: "ARCHIVED" } },
    include: {
      phases: {
        select: { name: true, status: true, progress: true, estEnd: true },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { phases: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  const recentActivity = await dbc.activityLog.findMany({
    where: {
      project: { members: { some: { userId: session.user.id } } },
      createdAt: { gte: yesterday },
    },
    include: { project: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const now = new Date();
  const context = projects.map((p: any) => {
    const active = p.phases.filter((ph: any) => ph.status === "IN_PROGRESS");
    const overdue = p.phases.filter((ph: any) => ph.status !== "COMPLETE" && new Date(ph.estEnd) < now);
    const completed = p.phases.filter((ph: any) => ph.status === "COMPLETE").length;
    return [
      `## ${p.name} (${p.status})`,
      `- Progress: ${completed}/${p._count.phases} phases complete`,
      `- Active: ${active.map((a: any) => a.name).join(", ") || "none"}`,
      overdue.length > 0 ? `- ⚠ OVERDUE: ${overdue.map((o: any) => o.name).join(", ")}` : null,
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const activityContext = recentActivity.length > 0
    ? `\n\n## Yesterday's Activity:\n${recentActivity.map((a: any) => `- [${a.project.name}] ${a.message}`).join("\n")}`
    : "";

  const result = await callAI(
    [
      {
        role: "system",
        content:
          `You are a construction PM assistant creating a morning briefing digest. ` +
          `Review all the user's projects and create a concise morning overview.\n\n` +
          `Return ONLY valid JSON:\n` +
          `{"greeting": "brief morning greeting", ` +
          `"projectSummaries": [{"projectName": "...", "status": "1-line status", "topPriority": "what to focus on", "alertLevel": "green|yellow|red"}], ` +
          `"todaysPriorities": ["priority 1", ...], "alertsAndRisks": ["alert 1", ...], ` +
          `"overallSummary": "2-sentence cross-project summary"}`,
      },
      { role: "user", content: context + activityContext },
    ],
    { maxTokens: 1024, temperature: 0.3, feature: "morning_digest", userId: session.user.id }
  );

  if (!result.success || !result.text) throw new Error(`Morning digest failed: ${result.error}`);

  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      greeting: "Good morning",
      projectSummaries: [],
      todaysPriorities: [],
      alertsAndRisks: [],
      overallSummary: result.text.slice(0, 300),
    };
  }
}

// ── #78 Schedule Risk Scoring ────────────────────────────────────────────

export interface ScheduleRiskResult {
  overallRisk: "low" | "medium" | "high" | "critical";
  riskScore: number;
  phaseRisks: Array<{
    phaseName: string;
    riskLevel: "low" | "medium" | "high" | "critical";
    riskFactors: string[];
    recommendation: string;
  }>;
  summary: string;
  mitigations: string[];
}

/**
 * AI-predicted schedule risk scoring for a project.
 * Analyses phase durations, progress rates, dependencies, and history
 * to predict schedule slip probability.
 */
export async function analyzeScheduleRisk(
  projectId: string
): Promise<ScheduleRiskResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const dbc = db as any;
  const [project, phases, dailyLogs] = await Promise.all([
    dbc.project.findUnique({
      where: { id: projectId },
      select: { name: true, startDate: true, endDate: true, status: true },
    }),
    dbc.phase.findMany({
      where: { projectId },
      select: {
        name: true, status: true, progress: true, estStart: true, estEnd: true,
        worstEnd: true, isMilestone: true, sortOrder: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
    dbc.dailyLog.findMany({
      where: { projectId },
      select: { date: true, weatherDelay: true },
      orderBy: { date: "desc" },
      take: 30,
    }).catch(() => []),
  ]);

  if (!project) throw new Error("Project not found");

  const now = new Date();
  const context = [
    `Project: "${project.name}" (${project.status})`,
    `Schedule: ${project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "N/A"} to ${project.endDate ? new Date(project.endDate).toISOString().split("T")[0] : "N/A"}`,
    `Today: ${now.toISOString().split("T")[0]}`,
    `\n## Phases (${phases.length} total):`,
    ...phases.map((p: any) => {
      const estEnd = new Date(p.estEnd);
      const daysLeft = Math.ceil((estEnd.getTime() - now.getTime()) / 86400000);
      const overdue = p.status !== "COMPLETE" && estEnd < now;
      return `- ${p.name}: ${p.status}, ${p.progress || 0}% done, ${overdue ? `OVERDUE by ${-daysLeft}d` : `${daysLeft}d remaining`}${p.isMilestone ? " [MILESTONE]" : ""}`;
    }),
    dailyLogs.some((d: any) => d.weatherDelay) ? `\n## Weather Delays: ${dailyLogs.filter((d: any) => d.weatherDelay).length} in last 30 days` : "",
  ].filter(Boolean).join("\n");

  const result = await callAI(
    [
      {
        role: "system",
        content:
          `You are a construction schedule risk analyst. Assess schedule risk based on phase progress, deadlines, and patterns.\n\n` +
          `Return ONLY valid JSON:\n` +
          `{"overallRisk": "low|medium|high|critical", "riskScore": 0-100, ` +
          `"phaseRisks": [{"phaseName": "...", "riskLevel": "low|medium|high|critical", "riskFactors": ["..."], "recommendation": "..."}], ` +
          `"summary": "2-sentence risk assessment", "mitigations": ["mitigation 1", ...]}` +
          `\n\nRisk guide: low=on track, medium=minor delays possible, high=likely delays, critical=major schedule slip imminent.`,
      },
      { role: "user", content: context },
    ],
    { maxTokens: 1024, temperature: 0.2, feature: "schedule_risk", userId: session.user.id }
  );

  if (!result.success || !result.text) throw new Error(`Schedule risk analysis failed: ${result.error}`);

  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { overallRisk: "medium", riskScore: 50, phaseRisks: [], summary: result.text.slice(0, 300), mitigations: [] };
  }
}

// ── #79 Budget Trend Prediction ──────────────────────────────────────────

export interface BudgetPrediction {
  currentSpend: number;
  projectedTotal: number;
  budgetAmount: number;
  projectedVariance: number;
  trend: "under_budget" | "on_track" | "over_budget" | "significantly_over";
  monthlyBurnRate: number;
  estimatedCompletionCost: string;
  insights: string[];
  recommendations: string[];
}

/**
 * AI budget trend prediction for a project.
 * Analyses spend history, phase costs, and change orders
 * to forecast final project cost.
 */
export async function predictBudgetTrend(
  projectId: string
): Promise<BudgetPrediction> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const dbc = db as any;
  const [project, phases, changeOrders] = await Promise.all([
    dbc.project.findUnique({
      where: { id: projectId },
      select: { name: true, budget: true, startDate: true, endDate: true },
    }),
    dbc.phase.findMany({
      where: { projectId },
      select: { name: true, status: true, budget: true, actualCost: true, progress: true },
    }),
    dbc.changeOrder.findMany({
      where: { phase: { projectId } },
      select: { title: true, amount: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }).catch(() => []),
  ]);

  if (!project) throw new Error("Project not found");

  const totalBudget = project.budget || 0;
  const totalSpent = phases.reduce((s: number, p: any) => s + (p.actualCost || 0), 0);
  const totalCOAmount = changeOrders.filter((co: any) => co.status === "APPROVED").reduce((s: number, co: any) => s + (co.amount || 0), 0);
  const avgProgress = phases.length > 0 ? phases.reduce((s: number, p: any) => s + (p.progress || 0), 0) / phases.length : 0;

  const context = [
    `Project: "${project.name}"`,
    `Budget: $${totalBudget.toLocaleString()}`,
    `Spent to date: $${totalSpent.toLocaleString()}`,
    `Overall progress: ${Math.round(avgProgress)}%`,
    `Approved change orders: $${totalCOAmount.toLocaleString()} (${changeOrders.filter((co: any) => co.status === "APPROVED").length} COs)`,
    `\n## Phase Budgets:`,
    ...phases.map((p: any) => `- ${p.name}: budget $${(p.budget || 0).toLocaleString()}, spent $${(p.actualCost || 0).toLocaleString()}, ${p.progress || 0}% done`),
    changeOrders.length > 0 ? `\n## Change Orders (${changeOrders.length} total):` : "",
    ...changeOrders.slice(-10).map((co: any) => `- ${co.title}: ${co.status}, $${(co.amount || 0).toLocaleString()}`),
  ].filter(Boolean).join("\n");

  const result = await callAI(
    [
      {
        role: "system",
        content:
          `You are a construction cost estimator. Analyse the project's budget and spending patterns to predict the final cost.\n\n` +
          `Return ONLY valid JSON:\n` +
          `{"currentSpend": number, "projectedTotal": number, "budgetAmount": number, ` +
          `"projectedVariance": number (positive=over, negative=under), ` +
          `"trend": "under_budget|on_track|over_budget|significantly_over", ` +
          `"monthlyBurnRate": number, "estimatedCompletionCost": "$X", ` +
          `"insights": ["insight 1", ...], "recommendations": ["rec 1", ...]}\n\n` +
          `Use the progress vs spend ratio to extrapolate. Be realistic.`,
      },
      { role: "user", content: context },
    ],
    { maxTokens: 1024, temperature: 0.2, feature: "budget_prediction", userId: session.user.id }
  );

  if (!result.success || !result.text) throw new Error(`Budget prediction failed: ${result.error}`);

  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      currentSpend: totalSpent,
      projectedTotal: totalBudget,
      budgetAmount: totalBudget,
      projectedVariance: 0,
      trend: "on_track",
      monthlyBurnRate: 0,
      estimatedCompletionCost: `$${totalBudget.toLocaleString()}`,
      insights: [],
      recommendations: [],
    };
  }
}

// ── #80 Weather Impact Forecasting ───────────────────────────────────────

export interface WeatherImpactResult {
  riskLevel: "low" | "medium" | "high";
  potentialDelayDays: number;
  affectedPhases: Array<{
    phaseName: string;
    impact: string;
    delayRisk: "low" | "medium" | "high";
  }>;
  historicalPattern: string;
  recommendations: string[];
  summary: string;
}

/**
 * Weather impact forecasting for a project.
 * Analyses historical weather delays and current schedule
 * to predict weather-related risks.
 */
export async function forecastWeatherImpact(
  projectId: string
): Promise<WeatherImpactResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const dbc = db as any;
  const [project, phases, dailyLogs] = await Promise.all([
    dbc.project.findUnique({
      where: { id: projectId },
      select: { name: true, address: true, startDate: true, endDate: true },
    }),
    dbc.phase.findMany({
      where: { projectId, status: { not: "COMPLETE" } },
      select: { name: true, status: true, estStart: true, estEnd: true, progress: true },
    }),
    dbc.dailyLog.findMany({
      where: { projectId },
      select: { date: true, weather: true, weatherDelay: true, notes: true },
      orderBy: { date: "desc" },
      take: 60,
    }).catch(() => []),
  ]);

  if (!project) throw new Error("Project not found");

  const weatherDelays = dailyLogs.filter((d: any) => d.weatherDelay);
  const context = [
    `Project: "${project.name}"`,
    `Location: ${project.address || "Not specified"}`,
    `Schedule: ${project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "N/A"} to ${project.endDate ? new Date(project.endDate).toISOString().split("T")[0] : "N/A"}`,
    `\n## Remaining Phases:`,
    ...phases.map((p: any) => `- ${p.name}: ${p.status}, due ${new Date(p.estEnd).toISOString().split("T")[0]}`),
    `\n## Weather History (${dailyLogs.length} days recorded):`,
    `- Weather delays: ${weatherDelays.length} days`,
    ...weatherDelays.slice(0, 10).map((d: any) => `- ${new Date(d.date).toISOString().split("T")[0]}: ${d.weather || "delay"} — ${d.notes || "weather delay"}`),
    dailyLogs.length > 0 ? `\n## Recent Weather Conditions:` : "",
    ...dailyLogs.slice(0, 10).map((d: any) => `- ${new Date(d.date).toISOString().split("T")[0]}: ${d.weather || "not recorded"}`),
  ].filter(Boolean).join("\n");

  const result = await callAI(
    [
      {
        role: "system",
        content:
          `You are a construction scheduling expert assessing weather risk. Analyse historical weather patterns and predict impact on remaining schedule.\n\n` +
          `Return ONLY valid JSON:\n` +
          `{"riskLevel": "low|medium|high", "potentialDelayDays": number, ` +
          `"affectedPhases": [{"phaseName": "...", "impact": "description", "delayRisk": "low|medium|high"}], ` +
          `"historicalPattern": "1-sentence about weather pattern", ` +
          `"recommendations": ["rec 1", ...], "summary": "2-sentence assessment"}\n\n` +
          `Consider seasonal patterns and the project location.`,
      },
      { role: "user", content: context },
    ],
    { maxTokens: 1024, temperature: 0.2, feature: "weather_forecast", userId: session.user.id }
  );

  if (!result.success || !result.text) throw new Error(`Weather forecast failed: ${result.error}`);

  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      riskLevel: "medium",
      potentialDelayDays: 0,
      affectedPhases: [],
      historicalPattern: "Insufficient data",
      recommendations: [],
      summary: result.text.slice(0, 300),
    };
  }
}

// ── #81 Change Order Pattern Detection ───────────────────────────────────

export interface COPatternResult {
  totalChangeOrders: number;
  totalAmount: number;
  patterns: Array<{
    pattern: string;
    frequency: number;
    avgAmount: number;
    description: string;
  }>;
  riskFactors: string[];
  preventionStrategies: string[];
  summary: string;
}

/**
 * Change order pattern detection for a project.
 * Analyses change order history to identify recurring patterns,
 * common causes, and prevention strategies.
 */
export async function detectCOPatterns(
  projectId: string
): Promise<COPatternResult> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const dbc = db as any;
  const [project, changeOrders, phases] = await Promise.all([
    dbc.project.findUnique({
      where: { id: projectId },
      select: { name: true, budget: true },
    }),
    dbc.changeOrder.findMany({
      where: { phase: { projectId } },
      include: { phase: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }).catch(() => []),
    dbc.phase.findMany({
      where: { projectId },
      select: { name: true, budget: true },
    }),
  ]);

  if (!project) throw new Error("Project not found");

  const totalAmount = changeOrders.reduce((s: number, co: any) => s + (co.amount || 0), 0);

  const context = [
    `Project: "${project.name}", Budget: $${(project.budget || 0).toLocaleString()}`,
    `Total Change Orders: ${changeOrders.length}, Total Amount: $${totalAmount.toLocaleString()}`,
    `\n## Change Orders:`,
    ...changeOrders.map((co: any) =>
      `- "${co.title}" | Phase: ${co.phase?.name || "N/A"} | Amount: $${(co.amount || 0).toLocaleString()} | Status: ${co.status} | Date: ${new Date(co.createdAt).toISOString().split("T")[0]}${co.reason ? ` | Reason: ${co.reason}` : ""}`
    ),
    `\n## Phase Budgets:`,
    ...phases.map((p: any) => `- ${p.name}: $${(p.budget || 0).toLocaleString()}`),
  ].filter(Boolean).join("\n");

  if (changeOrders.length === 0) {
    return {
      totalChangeOrders: 0,
      totalAmount: 0,
      patterns: [],
      riskFactors: ["No change orders yet — continue tracking"],
      preventionStrategies: [],
      summary: "No change orders recorded for this project.",
    };
  }

  const result = await callAI(
    [
      {
        role: "system",
        content:
          `You are a construction cost control analyst. Identify patterns in the project's change orders.\n\n` +
          `Return ONLY valid JSON:\n` +
          `{"totalChangeOrders": N, "totalAmount": N, ` +
          `"patterns": [{"pattern": "name", "frequency": N, "avgAmount": N, "description": "explanation"}], ` +
          `"riskFactors": ["risk 1", ...], "preventionStrategies": ["strategy 1", ...], ` +
          `"summary": "2-sentence pattern summary"}\n\n` +
          `Look for: recurring reasons, phase concentrations, timing patterns, amount trends.`,
      },
      { role: "user", content: context },
    ],
    { maxTokens: 1024, temperature: 0.2, feature: "co_patterns", userId: session.user.id }
  );

  if (!result.success || !result.text) throw new Error(`CO pattern detection failed: ${result.error}`);

  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      totalChangeOrders: changeOrders.length,
      totalAmount,
      patterns: [],
      riskFactors: [],
      preventionStrategies: [],
      summary: result.text.slice(0, 300),
    };
  }
}
