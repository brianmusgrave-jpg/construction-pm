/**
 * @file analytics-types.ts
 * @description Shared TypeScript types for the analytics dashboard.
 *
 * `AnalyticsData` is the single aggregated payload returned by `getAnalyticsData()`
 * in `src/actions/analytics.ts`. All analytics widgets consume fields from this
 * interface — changing it requires updating both the server action and the
 * AnalyticsWidgets component.
 */

/** Full analytics payload for the dashboard analytics page. */
export interface AnalyticsData {
  /** Breakdown of projects by status enum (e.g. ACTIVE, COMPLETE, ON_HOLD). */
  projectStatusCounts: { status: string; count: number }[];
  /** Breakdown of phases by status enum across all projects. */
  phaseStatusCounts: { status: string; count: number }[];
  /** Aggregate budget figures: total estimated vs total actual spend. */
  budgetSummary: { totalEstimated: number; totalActual: number };
  /** Month-by-month activity counts: phases moved + documents uploaded. */
  monthlyActivity: { month: string; phases: number; documents: number }[];
  /** Per-team-member workload: count of phases currently assigned. */
  teamWorkload: { name: string; assignedPhases: number }[];
  /** Weekly trend of completed phases (rolling window). */
  phaseCompletionTrend: { week: string; completed: number }[];
  /** Cumulative S-curve data: planned vs actual spend over time. Used by the AreaChart. */
  budgetCurve: { month: string; planned: number; actual: number }[];
  /** Per-project budget breakdown for the comparison bar chart. */
  projectBudgets: { name: string; estimated: number; actual: number }[];
}

/**
 * Date range filter options for the analytics dashboard.
 * Maps to "last 3 months", "6 months", "12 months", or all-time.
 */
export type AnalyticsDateRange = "3m" | "6m" | "12m" | "all";
