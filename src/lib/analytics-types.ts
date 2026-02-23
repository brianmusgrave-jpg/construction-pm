export interface AnalyticsData {
  projectStatusCounts: { status: string; count: number }[];
  phaseStatusCounts: { status: string; count: number }[];
  budgetSummary: { totalEstimated: number; totalActual: number };
  monthlyActivity: { month: string; phases: number; documents: number }[];
  teamWorkload: { name: string; assignedPhases: number }[];
  phaseCompletionTrend: { week: string; completed: number }[];
}
