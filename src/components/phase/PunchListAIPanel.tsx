"use client";

/**
 * @file PunchListAIPanel.tsx
 * @description AI-powered punch list enhancements panel — Sprint 27.
 * Shows completion prediction and photo AI analysis trigger.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  Camera,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { predictPunchListCompletion } from "@/actions/ai-punch-list";

interface PunchListAIPanelProps {
  projectId: string;
}

export default function PunchListAIPanel({ projectId }: PunchListAIPanelProps) {
  const t = useTranslations("punchListAI");
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handlePredict = async () => {
    setLoading(true);
    try {
      const result = await predictPunchListCompletion(projectId);
      if (result.success && result.prediction) {
        setPrediction(result.prediction);
        setExpanded(true);
      } else {
        toast.error(result.error || t("predictionFailed"));
      }
    } catch {
      toast.error(t("predictionFailed"));
    } finally {
      setLoading(false);
    }
  };

  const confidenceColor = (level: string) => {
    switch (level) {
      case "HIGH": return "text-green-600 bg-green-50";
      case "MEDIUM": return "text-yellow-600 bg-yellow-50";
      case "LOW": return "text-red-600 bg-red-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <div className="border border-purple-200 rounded-lg bg-purple-50/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-purple-900">{t("title")}</h3>
        </div>
        <button
          onClick={handlePredict}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <TrendingUp className="w-4 h-4" />
          )}
          {t("runPrediction")}
        </button>
      </div>

      {expanded && prediction && (
        <div className="mt-4 space-y-3">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white rounded-md p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {prediction.openItemsCount}
              </div>
              <div className="text-xs text-gray-500">{t("openItems")}</div>
            </div>
            <div className="bg-white rounded-md p-3 text-center">
              <div className="text-2xl font-bold text-red-600">
                {prediction.criticalBlockers}
              </div>
              <div className="text-xs text-gray-500">{t("criticalBlockers")}</div>
            </div>
            <div className="bg-white rounded-md p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {prediction.atRiskItems}
              </div>
              <div className="text-xs text-gray-500">{t("atRiskItems")}</div>
            </div>
            <div className="bg-white rounded-md p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {prediction.averageResolutionDays}d
              </div>
              <div className="text-xs text-gray-500">{t("avgResolution")}</div>
            </div>
          </div>

          {/* Estimated closeout */}
          <div className="bg-white rounded-md p-3 flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm font-medium text-gray-700">
                {t("estimatedCloseout")}
              </div>
              <div className="text-lg font-bold text-gray-900">
                {new Date(prediction.estimatedCloseoutDate).toLocaleDateString()}
              </div>
            </div>
            <div className={`ml-auto px-2 py-1 rounded text-xs font-medium ${confidenceColor(prediction.confidenceLevel)}`}>
              {prediction.confidenceLevel} {t("confidence")}
            </div>
          </div>

          {/* Insights */}
          {prediction.insights.length > 0 && (
            <div className="bg-white rounded-md p-3 space-y-2">
              <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                {t("insights")}
              </div>
              {prediction.insights.map((insight: string, i: number) => (
                <div key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
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
