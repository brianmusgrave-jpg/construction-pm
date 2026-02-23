export interface AnalyticsData {
  projectStatusCounts: { status: string; count: number }[];
  phaseStatusCounts: { status: string; count: number }[];
  budgetSummary: { totalEstimated: number; totalActual: number };
  monthlyActivity: { month: string; phases: number; documents: number }[];
  teamWorkload: { name: string; assignedPhases: number }[];
  phaseCompletionTrend: { week: string; completed: number }[];
  /** Cumulative S-curve data: planned vs actual spend over time */
  budgetCurve: { month: string; planned: number; actual: number }[];
  /** Per-project budget breakdown */
  projectBudgets: { name: string; estimated: number; actual: number }[];
}

export type AnalyticsDateRange = "3m" | "6m" | "12m" | "all";
