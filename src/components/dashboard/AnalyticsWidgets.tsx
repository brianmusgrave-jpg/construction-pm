"use client";

import type { AnalyticsData } from "@/actions/analytics";
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
} from "recharts";
import { TrendingUp, DollarSign, Users, BarChart2 } from "lucide-react";

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

export function AnalyticsWidgets({ data }: { data: AnalyticsData }) {
  const { totalEstimated, totalActual } = data.budgetSummary;
  const budgetVariance = totalActual - totalEstimated;
  const budgetPct =
    totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <BarChart2 className="w-4 h-4 text-[var(--color-primary)]" />
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Analytics
        </h2>
      </div>

      {/* Budget Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Estimated Budget</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{fmt(totalEstimated)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">Actual Spend</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{fmt(totalActual)}</p>
          {totalEstimated > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">{budgetPct}% of estimate</p>
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
            <span className="text-xs text-gray-500">Variance</span>
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
              ? "over budget"
              : budgetVariance < 0
              ? "under budget"
              : "on budget"}
          </p>
        </div>
      </div>

      {/* Monthly Activity + Phase Completion Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Activity Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <SectionHeader
            icon={<BarChart2 className="w-4 h-4 text-[var(--color-primary)]" />}
            title="Monthly Activity (6 months)"
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
              <Bar dataKey="phases" name="Phases" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="documents" name="Documents" fill="#a855f7" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Phase Completion Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <SectionHeader
            icon={<TrendingUp className="w-4 h-4 text-green-500" />}
            title="Phase Completions (8 weeks)"
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
                name="Completed"
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
            title="Project Status"
          />
          {data.projectStatusCounts.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No data</p>
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
            title="Phase Status"
          />
          {data.phaseStatusCounts.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No data</p>
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
            title="Team Workload"
          />
          {data.teamWorkload.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No assignments</p>
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
                  name="Phases"
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
