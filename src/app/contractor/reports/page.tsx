/**
 * @file src/app/contractor/reports/page.tsx
 * @description Contractor performance report page. Fetches performance data via
 * getContractorPerformance and renders a KPI grid, overdue alert, and a
 * phase breakdown table.
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getContractorPerformance } from "@/actions/reports";
import { cn, statusColor, statusLabel, fmtShort } from "@/lib/utils";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Camera,
  ClipboardCheck,
  TrendingUp,
  HardHat,
  ChevronRight,
  Target,
} from "lucide-react";

export default async function ContractorReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const report = await getContractorPerformance();
  const { summary, phases } = report;

  const activePhases = phases.filter(
    (p) =>
      p.status === "IN_PROGRESS" ||
      p.status === "REVIEW_REQUESTED" ||
      p.status === "UNDER_REVIEW"
  );
  const overduePhases = phases.filter((p) => p.daysOverdue > 0);
  const completedPhases = phases.filter((p) => p.status === "COMPLETE");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-[var(--color-primary)]" />
          My Performance
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Your work summary across all assigned phases
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--color-primary-bg)] border border-[var(--color-primary-bg)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <HardHat className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-xs font-medium text-[var(--color-primary)] opacity-80">
              Total Phases
            </span>
          </div>
          <p className="text-2xl font-bold text-[var(--color-primary)]">
            {summary.totalPhases}
          </p>
          <p className="text-xs text-[var(--color-primary)] opacity-60 mt-1">
            {summary.active} active · {summary.completed} done
          </p>
        </div>

        <div
          className={cn(
            "rounded-xl border p-4",
            summary.onTimeRate >= 80
              ? "bg-green-50 border-green-100"
              : summary.onTimeRate >= 50
              ? "bg-amber-50 border-amber-100"
              : "bg-red-50 border-red-100"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium opacity-80">On-Time Rate</span>
          </div>
          <p className="text-2xl font-bold">{summary.onTimeRate}%</p>
          <p className="text-xs opacity-60 mt-1">
            Completed on schedule
          </p>
        </div>

        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-green-600 opacity-80">
              Checklist
            </span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {summary.checklistProgress}%
          </p>
          <p className="text-xs text-green-600 opacity-60 mt-1">
            {summary.checklistItemsCompleted} items checked
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Camera className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium text-purple-600 opacity-80">
              Uploads
            </span>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {summary.documentsUploaded + summary.photosUploaded}
          </p>
          <p className="text-xs text-purple-600 opacity-60 mt-1">
            {summary.documentsUploaded} docs · {summary.photosUploaded} photos
          </p>
        </div>
      </div>

      {/* Overdue Alert */}
      {overduePhases.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Overdue ({overduePhases.length})
          </h3>
          <div className="space-y-2">
            {overduePhases.map((phase) => (
              <Link
                key={phase.id}
                href={`/contractor/phases/${phase.id}`}
                className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-red-50 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {phase.name}
                  </p>
                  <p className="text-xs text-gray-500">{phase.projectName}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-red-600">
                    {phase.daysOverdue}d late
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-500" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Phase-by-Phase Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Phase Breakdown
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {phases.length === 0 ? (
            <div className="p-8 text-center">
              <HardHat className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                No phases assigned yet
              </p>
            </div>
          ) : (
            phases.map((phase) => (
              <Link
                key={phase.id}
                href={`/contractor/phases/${phase.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {phase.name}
                    </p>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0",
                        statusColor(phase.status)
                      )}
                    >
                      {statusLabel(phase.status)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{phase.projectName}</p>
                  <div className="flex items-center gap-4 mt-2">
                    {/* Progress bar */}
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[120px]">
                        <div
                          className={cn(
                            "h-1.5 rounded-full",
                            phase.status === "COMPLETE"
                              ? "bg-green-500"
                              : phase.daysOverdue > 0
                              ? "bg-red-500"
                              : "bg-[var(--color-primary)]"
                          )}
                          style={{ width: `${phase.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {phase.progress}%
                      </span>
                    </div>
                    {/* Stats */}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {phase.checklistTotal > 0 && (
                        <span className="flex items-center gap-1">
                          <ClipboardCheck className="w-3 h-3" />
                          {phase.checklistDone}/{phase.checklistTotal}
                        </span>
                      )}
                      {phase.docs > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {phase.docs}
                        </span>
                      )}
                      {phase.photos > 0 && (
                        <span className="flex items-center gap-1">
                          <Camera className="w-3 h-3" />
                          {phase.photos}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {phase.daysOverdue > 0 && (
                  <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
                    {phase.daysOverdue}d late
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[var(--color-primary)] shrink-0" />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
