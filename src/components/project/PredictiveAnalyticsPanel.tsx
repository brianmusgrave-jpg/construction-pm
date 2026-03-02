"use client";

/**
 * @file PredictiveAnalyticsPanel.tsx
 * @description AI Predictive Analytics panel — Sprint 34.
 * Schedule risk prediction and budget forecasting at the project level.
 * Amber-themed to indicate forward-looking predictive nature.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Loader2,
  CheckCircle2,
  Clock,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { predictScheduleRisks, forecastBudget } from "@/actions/ai-predictive";

interface PredictiveAnalyticsPanelProps {
  projectId: string;
}

export default function PredictiveAnalyticsPanel({
  projectId,
}: PredictiveAnalyticsPanelProps) {
  const t = useTranslations("predictiveAI");

  const [schedule, setSchedule] = useState<any>(null);
  const [analyzingSchedule, setAnalyzingSchedule] = useState(false);

  const [budget, setBudget] = useState<any>(null);
  const [forecastingBudget, setForecastingBudget] = useState(false);

  const handleScheduleRisk = async () => {
    setAnalyzingSchedule(true);
    setSchedule(null);
    try {
      const result = await predictScheduleRisks(projectId);
      if (result.success && result.prediction) {
        setSchedule(result.prediction);
        toast.success(t("scheduleAnalyzed"));
      } else {
        toast.error(result.error || t("scheduleFailed"));
      }
    } catch {
      toast.error(t("scheduleFailed"));
    } finally {
      setAnalyzingSchedule(false);
    }
  };

  const handleBudgetForecast = async () => {
    setForecastingBudget(true);
    setBudget(null);
    try {
      const result = await forecastBudget(projectId);
      if (result.success && result.forecast) {
        setBudget(result.forecast);
        toast.success(t("budgetForecasted"));
      } else {
        toast.error(result.error || t("budgetFailed"));
      }
    } catch {
      toast.error(t("budgetFailed"));
    } finally {
      setForecastingBudget(false);
    }
  };

  const riskBadge = (level: string) => {
    switch (level) {
      case "CRITICAL": return "bg-red-100 text-red-700";
      case "HIGH": return "bg-orange-100 text-orange-700";
      case "MODERATE": return "bg-yellow-100 text-yellow-700";
      case "LOW": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const confidenceBadge = (level: string) => {
    switch (level) {
      case "HIGH": return "bg-green-100 text-green-700";
      case "MODERATE": return "bg-yellow-100 text-yellow-700";
      case "LOW": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const trendIcon = (trend: string) => {
    if (trend.toLowerCase().includes("over") || trend.toLowerCase().includes("up")) {
      return "↑";
    }
    if (trend.toLowerCase().includes("under") || trend.toLowerCase().includes("down")) {
      return "↓";
    }
    return "→";
  };

  return (
    <div className="border border-amber-200 rounded-lg bg-amber-50/50 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-amber-600" />
        <h3 className="font-semibold text-amber-900">{t("title")}</h3>
      </div>

      {/* Schedule Risk Prediction */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Clock className="w-4 h-4 text-amber-500" />
            {t("scheduleRisk")}
          </div>
          <button
            onClick={handleScheduleRisk}
            disabled={analyzingSchedule}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {analyzingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            {analyzingSchedule ? t("analyzing") : t("analyzeSchedule")}
          </button>
        </div>

        {schedule && (
          <div className="border border-amber-200 rounded-md p-3 space-y-3">
            {/* Overall Risk Score */}
            <div className="flex items-center justify-between">
              <span className={`text-2xl font-bold ${schedule.riskScore >= 7 ? "text-red-600" : schedule.riskScore >= 4 ? "text-yellow-600" : "text-green-600"}`}>
                {schedule.riskScore}/10
              </span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${riskBadge(schedule.overallRisk)}`}>
                {schedule.overallRisk} {t("risk")}
              </span>
            </div>

            {/* At-Risk Phases */}
            {schedule.atRiskPhases?.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {t("atRiskPhases")}
                </div>
                {schedule.atRiskPhases.map((phase: any, i: number) => (
                  <div key={i} className="text-xs bg-gray-50 rounded px-2 py-1.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">{phase.phaseName}</span>
                      <span className={`px-1.5 py-0.5 rounded ${riskBadge(phase.riskLevel)}`}>
                        {phase.riskLevel}
                      </span>
                    </div>
                    <div className="flex gap-3 text-gray-500">
                      <span>{t("progress")}: {phase.currentProgress}%</span>
                      <span>{t("expected")}: {phase.expectedProgress}%</span>
                      <span>{phase.daysRemaining}d {t("remaining")}</span>
                    </div>
                    {phase.riskFactors?.length > 0 && (
                      <div className="text-gray-400">
                        {phase.riskFactors.join("; ")}
                      </div>
                    )}
                    <div className="text-amber-600 italic">{phase.suggestedAction}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Critical Path */}
            {schedule.criticalPath?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-600">{t("criticalPath")}</div>
                <div className="text-xs text-gray-500 flex flex-wrap gap-1 items-center">
                  {schedule.criticalPath.map((p: string, i: number) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-gray-300">→</span>}
                      <span className="bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">{p}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {schedule.recommendations?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {t("recommendations")}
                </div>
                {schedule.recommendations.map((r: string, i: number) => (
                  <div key={i} className="text-xs text-green-600 pl-4">• {r}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Budget Forecasting */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <DollarSign className="w-4 h-4 text-amber-500" />
            {t("budgetForecast")}
          </div>
          <button
            onClick={handleBudgetForecast}
            disabled={forecastingBudget}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {forecastingBudget ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            {forecastingBudget ? t("forecasting") : t("forecastBudget")}
          </button>
        </div>

        {budget && (
          <div className="border border-amber-200 rounded-md p-3 space-y-3">
            {/* Headline Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 rounded p-2 text-center">
                <div className="text-xs text-gray-500">{t("projectedCost")}</div>
                <div className="text-sm font-bold text-gray-800">{budget.projectedFinalCost}</div>
              </div>
              <div className="bg-gray-50 rounded p-2 text-center">
                <div className="text-xs text-gray-500">{t("variance")}</div>
                <div className="text-sm font-bold text-gray-800">{budget.costVariance}</div>
              </div>
              <div className="bg-gray-50 rounded p-2 text-center">
                <div className="text-xs text-gray-500">{t("confidence")}</div>
                <span className={`text-xs px-1.5 py-0.5 rounded ${confidenceBadge(budget.confidenceLevel)}`}>
                  {budget.confidenceLevel}
                </span>
              </div>
            </div>

            {budget.forecastAccuracy && (
              <p className="text-xs text-gray-500 italic">{budget.forecastAccuracy}</p>
            )}

            {/* Category Breakdown */}
            {budget.categoryBreakdown?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-amber-600">{t("categoryBreakdown")}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b">
                        <th className="text-left py-1">{t("category")}</th>
                        <th className="text-right py-1">{t("budgeted")}</th>
                        <th className="text-right py-1">{t("spent")}</th>
                        <th className="text-right py-1">{t("projected")}</th>
                        <th className="text-right py-1">{t("trend")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budget.categoryBreakdown.map((cat: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-1 font-medium text-gray-700">{cat.category}</td>
                          <td className="py-1 text-right text-gray-500">${cat.budgeted?.toLocaleString()}</td>
                          <td className="py-1 text-right text-gray-500">${cat.spent?.toLocaleString()}</td>
                          <td className="py-1 text-right text-gray-700">${cat.projected?.toLocaleString()}</td>
                          <td className="py-1 text-right">
                            <span className="text-gray-500">{trendIcon(cat.trend || "")} {cat.variance || ""}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Change Order Impact */}
            {budget.changeOrderImpact && budget.changeOrderImpact.totalCOs > 0 && (
              <div className="bg-gray-50 rounded p-2 space-y-1">
                <div className="text-xs font-medium text-amber-600">{t("changeOrderImpact")}</div>
                <div className="text-xs flex items-center gap-3">
                  <span className="text-gray-700">{budget.changeOrderImpact.totalCOs} COs</span>
                  <span className="text-gray-700">{budget.changeOrderImpact.totalAmount}</span>
                  <span className={`px-1.5 py-0.5 rounded ${riskBadge(budget.changeOrderImpact.riskLevel)}`}>
                    {budget.changeOrderImpact.riskLevel}
                  </span>
                </div>
                <div className="text-xs text-gray-500">{budget.changeOrderImpact.pattern}</div>
              </div>
            )}

            {/* Cash Flow Projection */}
            {budget.cashFlowProjection?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-amber-600">{t("cashFlowProjection")}</div>
                {budget.cashFlowProjection.map((cf: any, i: number) => (
                  <div key={i} className="text-xs flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                    <span className="font-medium text-gray-700">{cf.period}</span>
                    <span className="text-gray-600">{cf.projected}</span>
                    {cf.note && <span className="text-gray-400 italic text-[10px]">{cf.note}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {budget.recommendations?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {t("recommendations")}
                </div>
                {budget.recommendations.map((r: string, i: number) => (
                  <div key={i} className="text-xs text-green-600 pl-4">• {r}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
