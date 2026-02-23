"use client";

import { useState, useCallback } from "react";
import type { AnalyticsData, AnalyticsDateRange } from "@/lib/analytics-types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  Users,
  BarChart2,
  Download,
} from "lucide-react";
import { useTranslations } from "next-intl";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#3b82f6",
  PLANNING: "#a855f7",
  ON_HOLD: "#f59e0b",
  COMPLETE: "#22c55e",
  ARCHIVED: "#6b7280",
  IN_PROGRESS: "#3b82f6",
  PENDING: "#94a3b8",
  REVIEW_REQUESTED: "#f59e0b",
  UNDER_REVIEW: "#f97316",
  APPROVED: "#22c55e",
  REJECTED: "#ef4444",
};

const CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#f97316",
  "#ec4899",
  "#06b6d4",
  "#6366f1",
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
      {icon}
      {title}
    </h3>
  );
}

const DATE_RANGES: { key: AnalyticsDateRange; label: string }[] = [
  { key: "3m", label: "3 months" },
  { key: "6m", label: "6 months" },
  { key: "12m", label: "12 months" },
  { key: "all", label: "All time" },
];

interface Props {
  data: AnalyticsData;
  onRangeChange?: (range: AnalyticsDateRange) => void;
}

export function AnalyticsWidgets({ data, onRangeChange }: Props) {
  const t = useTranslations("analytics");
  const [selectedRange, setSelectedRange] = useState<AnalyticsDateRange>("6m");
  const { totalEstimated, totalActual } = data.budgetSummary;
  const budgetVariance = totalActual - totalEstimated;
  const budgetPct =
    totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : 0;

  function handleRangeChange(range: AnalyticsDateRange) {
    setSelectedRange(range);
    onRangeChange?.(range);
  }

  const handleExport = useCallback(() => {
    // Build CSV from all analytics data
    const lines: string[] = [];

    // Budget summary
    lines.push("Section,Metric,Value");
    lines.push(`Budget,Estimated,${totalEstimated}`);
    lines.push(`Budget,Actual,${totalActual}`);
    lines.push(`Budget,Variance,${budgetVariance}`);
    lines.push("");

    // Project status
    lines.push("Project Status,Count");
    for (const ps of data.projectStatusCounts) {
      lines.push(`${ps.status},${ps.count}`);
    }
    lines.push("");

    // Phase status
    lines.push("Phase Status,Count");
    for (const ps of data.phaseStatusCounts) {
      lines.push(`${ps.status},${ps.count}`);
    }
    lines.push("");

    // Monthly activity
    lines.push("Month,Phases Created,Documents Added");
    for (const ma of data.monthlyActivity) {
      lines.push(`${ma.month},${ma.phases},${ma.documents}`);
    }
    lines.push("");

    // Team workload
    lines.push("Team Member,Assigned Phases");
    for (const tw of data.teamWorkload) {
      lines.push(`"${tw.name}",${tw.assignedPhases}`);
    }
    lines.push("");

    // Budget curve
    if (data.budgetCurve?.length) {
      lines.push("Month,Planned (Cumulative),Actual (Cumulative)");
      for (const bc of data.budgetCurve) {
        lines.push(`${bc.month},${bc.planned},${bc.actual}`);
      }
      lines.push("");
    }

    // Project budgets
    if (data.projectBudgets?.length) {
      lines.push("Project,Estimated,Actual");
      for (const pb of data.projectBudgets) {
        lines.push(`"${pb.name}",${pb.estimated},${pb.actual}`);
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, totalEstimated, totalActual, budgetVariance]);

  return (
    <div className="space-y-5">
      {/* Header with date range + export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            {t("title")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {DATE_RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => handleRangeChange(r.key)}
                className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                  selectedRange === r.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {/* Export button */}
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {t("export")}
          </button>
        </div>
      </div>

      {/* Budget Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">{t("estimatedBudget")}</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{fmt(totalEstimated)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">{t("actualSpend")}</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{fmt(totalActual)}</p>
          {totalEstimated > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">{budgetPct}% {t("ofEstimate")}</p>
          )}
        </div>
        <div
          className={
            "bg-white rounded-xl border p-4 " +
            (budgetVariance > 0
              ? "border-red-200"
              : budgetVariance < 0
              ? "border-green-200"
              : "border-gray-200")
          }
        >
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp
              className={
                "w-4 h-4 " +
                (budgetVariance > 0
                  ? "text-red-500"
                  : budgetVariance < 0
                  ? "text-green-500"
                  : "text-gray-400")
              }
            />
            <span className="text-xs text-gray-500">{t("variance")}</span>
          </div>
          <p
            className={
              "text-xl font-bold " +
              (budgetVariance > 0
                ? "text-red-600"
                : budgetVariance < 0
                ? "text-green-600"
                : "text-gray-900")
            }
          >
            {budgetVariance > 0 ? "+" : ""}
            {fmt(Math.abs(budgetVariance))}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {budgetVariance > 0
              ? t("overBudget")
              : budgetVariance < 0
              ? t("underBudget")
              : t("onBudget")}
          </p>
        </div>
      </div>

      {/* Budget S-Curve + Project Budget Comparison */}
      {(data.budgetCurve?.length > 0 || data.projectBudgets?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* S-Curve: Planned vs Actual */}
          {data.budgetCurve?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionHeader
                icon={<TrendingUp className="w-4 h-4 text-[var(--color-primary)]" />}
                title={t("budgetCurve")}
              />
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.budgetCurve} margin={{ top: 0, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="plannedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={(v: number) => fmt(v)}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    formatter={(v: number) => [fmt(v)]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    type="monotone"
                    dataKey="planned"
                    name={t("planned")}
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    fill="url(#plannedGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    name={t("actual")}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#actualGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Project Budget Comparison */}
          {data.projectBudgets?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionHeader
                icon={<DollarSign className="w-4 h-4 text-green-500" />}
                title={t("projectBudgets")}
              />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={data.projectBudgets}
                  margin={{ top: 0, right: 4, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={(v: number) => fmt(v)}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    formatter={(v: number) => [fmt(v)]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="estimated" name={t("estimated")} fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name={t("actual")} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Monthly Activity + Phase Completion Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Activity Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <SectionHeader
            icon={<BarChart2 className="w-4 h-4 text-[var(--color-primary)]" />}
            title={t("monthlyActivity")}
          />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.monthlyActivity} margin={{ top: 0, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="phases" name={t("phases")} fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="documents" name={t("documents")} fill="#a855f7" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Phase Completion Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <SectionHeader
            icon={<TrendingUp className="w-4 h-4 text-green-500" />}
            title={t("completionTrend")}
          />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart
              data={data.phaseCompletionTrend}
              margin={{ top: 0, right: 4, left: -24, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
              />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Line
                type="monotone"
                dataKey="completed"
                name={t("completed")}
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3, fill: "#22c55e" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status Pies + Team Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Project Status Pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <SectionHeader
            icon={<BarChart2 className="w-4 h-4 text-[var(--color-primary)]" />}
            title={t("projectStatus")}
          />
          {data.projectStatusCounts.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">{t("noData")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={data.projectStatusCounts}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={2}
                >
                  {data.projectStatusCounts.map((entry, i) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS[entry.status] ?? CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  formatter={(v: number, name: string) => [v, name.replace(/_/g, " ")]}
                />
                <Legend
                  formatter={(v: string) => v.replace(/_/g, " ")}
                  wrapperStyle={{ fontSize: 10 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Phase Status Pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <SectionHeader
            icon={<BarChart2 className="w-4 h-4 text-purple-500" />}
            title={t("phaseStatus")}
          />
          {data.phaseStatusCounts.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">{t("noData")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={data.phaseStatusCounts}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={2}
                >
                  {data.phaseStatusCounts.map((entry, i) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS[entry.status] ?? CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  formatter={(v: number, name: string) => [v, name.replace(/_/g, " ")]}
                />
                <Legend
                  formatter={(v: string) => v.replace(/_/g, " ")}
                  wrapperStyle={{ fontSize: 10 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Team Workload */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <SectionHeader
            icon={<Users className="w-4 h-4 text-blue-500" />}
            title={t("teamWorkload")}
          />
          {data.teamWorkload.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">{t("noAssignments")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                layout="vertical"
                data={data.teamWorkload}
                margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  width={72}
                  tickFormatter={(v: string) =>
                    v.length > 10 ? v.slice(0, 10) + "…" : v
                  }
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <Bar
                  dataKey="assignedPhases"
                  name={t("phases")}
                  fill="#3b82f6"
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
