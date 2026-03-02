"use client";

/**
 * @file TimeTrackingAIPanel.tsx
 * @description AI-powered time tracking enhancements panel — Sprint 27.
 * Shows anomaly detection and labor cost forecasting.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  Shield,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { detectTimeAnomalies } from "@/actions/ai-time-tracking";
import { forecastLaborCosts } from "@/actions/ai-time-tracking";

interface TimeTrackingAIPanelProps {
  projectId: string;
}

export default function TimeTrackingAIPanel({ projectId }: TimeTrackingAIPanelProps) {
  const t = useTranslations("timeTrackingAI");
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [loadingAnomalies, setLoadingAnomalies] = useState(false);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [showForecast, setShowForecast] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);

  const handleAnomalyDetection = async () => {
    setLoadingAnomalies(true);
    try {
      const result = await detectTimeAnomalies(projectId);
      if (result.success) {
        setAnomalies(result.anomalies || []);
        setScannedCount(result.totalEntriesScanned);
        setShowAnomalies(true);
        if ((result.anomalies || []).length === 0) {
          toast.success(t("noAnomalies"));
        }
      } else {
        toast.error(result.error || t("anomalyFailed"));
      }
    } catch {
      toast.error(t("anomalyFailed"));
    } finally {
      setLoadingAnomalies(false);
    }
  };

  const handleForecast = async () => {
    setLoadingForecast(true);
    try {
      const result = await forecastLaborCosts(projectId);
      if (result.success && result.forecast) {
        setForecast(result.forecast);
        setShowForecast(true);
      } else {
        toast.error(result.error || t("forecastFailed"));
      }
    } catch {
      toast.error(t("forecastFailed"));
    } finally {
      setLoadingForecast(false);
    }
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case "HIGH": return "text-red-700 bg-red-50 border-red-200";
      case "MEDIUM": return "text-yellow-700 bg-yellow-50 border-yellow-200";
      case "LOW": return "text-blue-700 bg-blue-50 border-blue-200";
      default: return "text-gray-700 bg-gray-50 border-gray-200";
    }
  };

  const trendColor = (trend: string) => {
    switch (trend) {
      case "UNDER_BUDGET": return "text-green-700 bg-green-50";
      case "ON_TRACK": return "text-blue-700 bg-blue-50";
      case "AT_RISK": return "text-yellow-700 bg-yellow-50";
      case "OVER_BUDGET": return "text-red-700 bg-red-50";
      default: return "text-gray-700 bg-gray-50";
    }
  };

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-blue-900">{t("title")}</h3>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleAnomalyDetection}
          disabled={loadingAnomalies}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loadingAnomalies ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Shield className="w-4 h-4" />
          )}
          {t("detectAnomalies")}
        </button>
        <button
          onClick={handleForecast}
          disabled={loadingForecast}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loadingForecast ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <DollarSign className="w-4 h-4" />
          )}
          {t("forecastCosts")}
        </button>
      </div>

      {/* Anomaly results */}
      {showAnomalies && (
        <div className="bg-white rounded-md p-3 space-y-2">
          <button
            onClick={() => setShowAnomalies(!showAnomalies)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Shield className="w-4 h-4 text-blue-500" />
              {t("anomalyResults", { count: anomalies.length, scanned: scannedCount })}
            </div>
            {showAnomalies ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {anomalies.length > 0 ? (
            <div className="space-y-2 mt-2">
              {anomalies.slice(0, 10).map((anomaly, i) => (
                <div
                  key={i}
                  className={`border rounded-md p-2 text-sm ${severityColor(anomaly.severity)}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{anomaly.workerName}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium">
                      {anomaly.severity}
                    </span>
                  </div>
                  <div className="mt-1 text-xs opacity-80">{anomaly.description}</div>
                  <div className="mt-1 text-xs opacity-60">
                    {anomaly.date} · {anomaly.hours}h
                  </div>
                </div>
              ))}
              {anomalies.length > 10 && (
                <div className="text-xs text-gray-500 text-center">
                  +{anomalies.length - 10} {t("more")}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-green-600 flex items-center gap-1.5 mt-1">
              <Shield className="w-4 h-4" />
              {t("noAnomaliesFound")}
            </div>
          )}
        </div>
      )}

      {/* Forecast results */}
      {showForecast && forecast && (
        <div className="bg-white rounded-md p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <TrendingUp className="w-4 h-4 text-green-500" />
              {t("laborForecast")}
            </div>
            <span className={`text-xs px-2 py-1 rounded font-medium ${trendColor(forecast.trend)}`}>
              {forecast.trend.replace("_", " ")}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-lg font-bold text-gray-900">
                {forecast.totalHoursToDate}h
              </div>
              <div className="text-xs text-gray-500">{t("hoursToDate")}</div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-lg font-bold text-gray-900">
                ${Math.round(forecast.totalCostToDate).toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">{t("costToDate")}</div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-lg font-bold text-gray-900">
                {forecast.averageDailyHours}h
              </div>
              <div className="text-xs text-gray-500">{t("avgDaily")}</div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-lg font-bold text-blue-600">
                {forecast.projectedTotalHours}h
              </div>
              <div className="text-xs text-gray-500">{t("projectedTotal")}</div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-lg font-bold text-blue-600">
                ${Math.round(forecast.projectedTotalCost).toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">{t("projectedCost")}</div>
            </div>
            {forecast.burnRate > 0 && (
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-lg font-bold text-orange-600">
                  {forecast.burnRate}%
                </div>
                <div className="text-xs text-gray-500">{t("budgetUsed")}</div>
              </div>
            )}
          </div>

          {/* Insights */}
          {forecast.insights.length > 0 && (
            <div className="space-y-1">
              {forecast.insights.map((insight: string, i: number) => (
                <div key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                  {insight}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
