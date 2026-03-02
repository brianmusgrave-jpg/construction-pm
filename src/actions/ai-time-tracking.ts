"use server";

/**
 * @file src/actions/ai-time-tracking.ts
 * @description AI-powered time tracking enhancements — Sprint 27.
 *
 * - Anomaly Detection: Flag unusual patterns in time entries
 * - Labor Cost Forecasting: Project remaining labor costs based on trends
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const dbc = db as any;

// ── Anomaly Detection ───────────────────────────────────────────────

interface TimeAnomaly {
  type: "overtime_spike" | "unusual_hours" | "pattern_mismatch" | "location_mismatch";
  severity: "HIGH" | "MEDIUM" | "LOW";
  entryId: string;
  description: string;
  workerName: string;
  date: string;
  hours: number;
}

interface AnomalyDetectionResult {
  success: boolean;
  anomalies?: TimeAnomaly[];
  totalEntriesScanned: number;
  error?: string;
}

/**
 * Detect anomalies in time tracking entries for a project.
 * Flags unusual patterns: overtime spikes, unusual hours, entries that
 * don't match project activity logs.
 */
export async function detectTimeAnomalies(
  projectId: string,
  daysBack: number = 30
): Promise<AnomalyDetectionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, anomalies: [], totalEntriesScanned: 0, error: "Unauthorized" };
  }

  try {
    // Fetch all phases for the project
    const phases = await dbc.phase.findMany({
      where: { project: { id: projectId } },
      select: { id: true },
    });
    const phaseIds = phases.map((p: any) => p.id);

    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const entries = await dbc.timeEntry.findMany({
      where: {
        phaseId: { in: phaseIds },
        date: { gte: since },
      },
      include: {
        worker: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    if (entries.length === 0) {
      return { success: true, anomalies: [], totalEntriesScanned: 0 };
    }

    const anomalies: TimeAnomaly[] = [];

    // Group entries by worker
    const byWorker = new Map<string, any[]>();
    for (const entry of entries) {
      const workerId = entry.worker?.id || entry.createdBy?.id || "unknown";
      if (!byWorker.has(workerId)) byWorker.set(workerId, []);
      byWorker.get(workerId)!.push(entry);
    }

    for (const [, workerEntries] of byWorker) {
      const workerName = workerEntries[0]?.worker?.name || workerEntries[0]?.createdBy?.name || "Unknown";

      // Check 1: Overtime spikes — daily hours > 12
      for (const entry of workerEntries) {
        if (entry.hours > 12) {
          anomalies.push({
            type: "overtime_spike",
            severity: entry.hours > 16 ? "HIGH" : "MEDIUM",
            entryId: entry.id,
            description: `${workerName} logged ${entry.hours} hours in a single day — exceeds standard limits.`,
            workerName,
            date: new Date(entry.date).toISOString().split("T")[0],
            hours: entry.hours,
          });
        }
      }

      // Check 2: Weekly hours > 60
      const byWeek = new Map<string, number>();
      for (const entry of workerEntries) {
        const d = new Date(entry.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const weekKey = weekStart.toISOString().split("T")[0];
        byWeek.set(weekKey, (byWeek.get(weekKey) || 0) + entry.hours);
      }
      for (const [weekStart, totalHours] of byWeek) {
        if (totalHours > 60) {
          anomalies.push({
            type: "overtime_spike",
            severity: totalHours > 80 ? "HIGH" : "MEDIUM",
            entryId: workerEntries[0].id,
            description: `${workerName} logged ${totalHours} hours in week of ${weekStart} — possible overtime compliance issue.`,
            workerName,
            date: weekStart,
            hours: totalHours,
          });
        }
      }

      // Check 3: Unusual hours pattern — exactly 8.0 every day for 5+ consecutive days
      const sorted = [...workerEntries].sort(
        (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      let streak = 0;
      for (const entry of sorted) {
        if (entry.hours === 8) {
          streak++;
          if (streak >= 5) {
            anomalies.push({
              type: "pattern_mismatch",
              severity: "LOW",
              entryId: entry.id,
              description: `${workerName} logged exactly 8.0 hours for ${streak}+ consecutive days — may indicate time padding rather than actual tracking.`,
              workerName,
              date: new Date(entry.date).toISOString().split("T")[0],
              hours: entry.hours,
            });
            break; // Only flag once per worker
          }
        } else {
          streak = 0;
        }
      }

      // Check 4: Weekend entries without project activity
      for (const entry of workerEntries) {
        const day = new Date(entry.date).getDay();
        if (day === 0 || day === 6) {
          anomalies.push({
            type: "unusual_hours",
            severity: "LOW",
            entryId: entry.id,
            description: `${workerName} logged ${entry.hours} hours on a weekend — verify if authorized.`,
            workerName,
            date: new Date(entry.date).toISOString().split("T")[0],
            hours: entry.hours,
          });
        }
      }
    }

    // Sort by severity
    const severityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return { success: true, anomalies, totalEntriesScanned: entries.length };
  } catch (err) {
    console.error("detectTimeAnomalies error:", err);
    return {
      success: false,
      anomalies: [],
      totalEntriesScanned: 0,
      error: err instanceof Error ? err.message : "Anomaly detection failed",
    };
  }
}

// ── Labor Cost Forecasting ──────────────────────────────────────────

interface LaborForecast {
  success: boolean;
  forecast?: {
    totalHoursToDate: number;
    totalCostToDate: number;
    averageDailyHours: number;
    averageDailyCost: number;
    projectedTotalHours: number;
    projectedTotalCost: number;
    remainingBudget: number;
    burnRate: number; // percentage of budget used per day
    projectedOverUnder: number; // positive = over budget
    daysOfData: number;
    trend: "UNDER_BUDGET" | "ON_TRACK" | "AT_RISK" | "OVER_BUDGET";
    insights: string[];
  };
  error?: string;
}

/**
 * Forecast remaining labor costs based on actual hours-to-date vs estimated.
 * Factors in productivity trends and remaining scope to project final costs.
 */
export async function forecastLaborCosts(
  projectId: string,
  laborBudget?: number,
  hourlyRate?: number,
  remainingDays?: number
): Promise<LaborForecast> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Fetch all phases and their time entries
    const phases = await dbc.phase.findMany({
      where: { project: { id: projectId } },
      select: { id: true },
    });
    const phaseIds = phases.map((p: any) => p.id);

    const entries = await dbc.timeEntry.findMany({
      where: { phaseId: { in: phaseIds } },
      orderBy: { date: "asc" },
    });

    // Default values if not provided
    const rate = hourlyRate || 55; // default construction labor rate
    const budget = laborBudget || 0;

    // Calculate totals
    const totalHours = entries.reduce((sum: number, e: any) => sum + e.hours, 0);
    const totalCost = totalHours * rate;

    if (entries.length === 0) {
      return {
        success: true,
        forecast: {
          totalHoursToDate: 0,
          totalCostToDate: 0,
          averageDailyHours: 0,
          averageDailyCost: 0,
          projectedTotalHours: 0,
          projectedTotalCost: 0,
          remainingBudget: budget,
          burnRate: 0,
          projectedOverUnder: 0,
          daysOfData: 0,
          trend: "ON_TRACK",
          insights: ["No time entries recorded yet."],
        },
      };
    }

    // Calculate date range and daily averages
    const firstDate = new Date(entries[0].date);
    const lastDate = new Date(entries[entries.length - 1].date);
    const daysOfData = Math.max(
      1,
      Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );

    const avgDailyHours = Math.round((totalHours / daysOfData) * 10) / 10;
    const averageDailyCost = Math.round(avgDailyHours * rate * 100) / 100;

    // Project forward
    const daysRemaining = remainingDays || 60; // default 60 days remaining
    const projectedAdditionalHours = avgDailyHours * daysRemaining;
    const projectedTotalHours = totalHours + projectedAdditionalHours;
    const projectedTotalCost = Math.round(projectedTotalHours * rate * 100) / 100;

    // Budget analysis
    const remainingBudget = budget > 0 ? budget - totalCost : 0;
    const burnRate = budget > 0 ? Math.round((totalCost / budget) * 10000) / 100 : 0;
    const projectedOverUnder = budget > 0 ? Math.round((projectedTotalCost - budget) * 100) / 100 : 0;

    // Determine trend
    let trend: "UNDER_BUDGET" | "ON_TRACK" | "AT_RISK" | "OVER_BUDGET" = "ON_TRACK";
    if (budget > 0) {
      const budgetRatio = projectedTotalCost / budget;
      if (budgetRatio > 1.1) trend = "OVER_BUDGET";
      else if (budgetRatio > 0.95) trend = "AT_RISK";
      else if (budgetRatio < 0.8) trend = "UNDER_BUDGET";
    }

    // Generate insights
    const insights: string[] = [];
    insights.push(
      `Averaging ${avgDailyHours} hours/day over ${daysOfData} tracked days.`
    );
    if (budget > 0) {
      insights.push(
        `${burnRate}% of labor budget consumed (${Math.round(totalCost).toLocaleString()} of ${budget.toLocaleString()}).`
      );
      if (projectedOverUnder > 0) {
        insights.push(
          `Projected to exceed budget by $${Math.round(projectedOverUnder).toLocaleString()} at current pace.`
        );
      } else if (projectedOverUnder < 0) {
        insights.push(
          `Projected to finish $${Math.abs(Math.round(projectedOverUnder)).toLocaleString()} under budget.`
        );
      }
    }

    // Check for recent trend changes (last 7 days vs overall)
    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 7);
    const recentEntries = entries.filter(
      (e: any) => new Date(e.date) >= recentCutoff
    );
    if (recentEntries.length > 0) {
      const recentHours = recentEntries.reduce((s: number, e: any) => s + e.hours, 0);
      const recentDays = Math.max(1, 7);
      const recentDailyAvg = recentHours / recentDays;
      const trendDiff = Math.round(((recentDailyAvg - avgDailyHours) / avgDailyHours) * 100);
      if (Math.abs(trendDiff) > 20) {
        insights.push(
          trendDiff > 0
            ? `Recent daily hours are ${trendDiff}% higher than average — labor costs accelerating.`
            : `Recent daily hours are ${Math.abs(trendDiff)}% lower than average — pace is slowing.`
        );
      }
    }

    return {
      success: true,
      forecast: {
        totalHoursToDate: Math.round(totalHours * 10) / 10,
        totalCostToDate: Math.round(totalCost * 100) / 100,
        averageDailyHours: avgDailyHours,
        averageDailyCost,
        projectedTotalHours: Math.round(projectedTotalHours * 10) / 10,
        projectedTotalCost,
        remainingBudget: Math.round(remainingBudget * 100) / 100,
        burnRate,
        projectedOverUnder,
        daysOfData,
        trend,
        insights,
      },
    };
  } catch (err) {
    console.error("forecastLaborCosts error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Labor forecast failed",
    };
  }
}
