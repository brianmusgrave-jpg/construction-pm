"use client";

/**
 * @file PunchListAIPanel.tsx
 * @description AI-powered punch list enhancements panel — Sprint 27 + Sprint 28.
 * Shows completion prediction and enhanced photo AI analysis trigger.
 * Sprint 28 adds: photo upload → AI analysis → create punch item flow.
 */

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  Camera,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Image,
} from "lucide-react";
import { toast } from "sonner";
import { predictPunchListCompletion, analyzePunchListPhoto } from "@/actions/ai-punch-list";

interface PunchListAIPanelProps {
  projectId: string;
  phaseId?: string;
  onCreateItem?: (data: { title: string; description: string; priority: string }) => void;
}

export default function PunchListAIPanel({
  projectId,
  phaseId,
  onCreateItem,
}: PunchListAIPanelProps) {
  const t = useTranslations("punchListAI");
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Photo AI state — Sprint 28
  const [photoAnalysis, setPhotoAnalysis] = useState<any>(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [showPhotoAI, setShowPhotoAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !phaseId) return;

    setAnalyzingPhoto(true);
    setShowPhotoAI(true);
    try {
      // Convert to data URL for the AI analysis
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const result = await analyzePunchListPhoto(dataUrl, projectId);
        if (result.success && result.suggestion) {
          // Wrap in issues array for consistent UI rendering
          setPhotoAnalysis({ issues: [result.suggestion], summary: "" });
          toast.success(t("photoAnalyzed"));
        } else {
          toast.error(result.error || t("photoAnalysisFailed"));
        }
        setAnalyzingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error(t("photoAnalysisFailed"));
      setAnalyzingPhoto(false);
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateFromAI = (suggestion: any) => {
    if (onCreateItem) {
      onCreateItem({
        title: suggestion.title || "AI-detected issue",
        description: suggestion.description || "",
        priority: suggestion.priority || "MINOR",
      });
      toast.success(t("itemCreated"));
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
    <div className="border border-purple-200 rounded-lg bg-purple-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-purple-900">{t("title")}</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Photo AI Upload — Sprint 28 */}
          {phaseId && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={analyzingPhoto}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {analyzingPhoto ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                {t("analyzePhoto")}
              </button>
            </>
          )}
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
      </div>

      {/* Photo AI Results — Sprint 28 */}
      {showPhotoAI && (
        <div className="bg-white rounded-md p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Image className="w-4 h-4 text-indigo-500" />
            {t("photoAIResults")}
          </div>
          {analyzingPhoto ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("analyzingPhoto")}
            </div>
          ) : photoAnalysis ? (
            <div className="space-y-2">
              {photoAnalysis.issues && photoAnalysis.issues.length > 0 ? (
                photoAnalysis.issues.map((issue: any, i: number) => (
                  <div
                    key={i}
                    className="border border-indigo-200 rounded-md p-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-800">
                        {issue.title}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          issue.priority === "CRITICAL"
                            ? "bg-red-100 text-red-700"
                            : issue.priority === "MAJOR"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {issue.priority}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {issue.description}
                    </p>
                    {issue.trade && (
                      <p className="text-xs text-indigo-500 mt-0.5">
                        Trade: {issue.trade}
                      </p>
                    )}
                    {onCreateItem && (
                      <button
                        onClick={() => handleCreateFromAI(issue)}
                        className="mt-2 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        <Plus className="w-3 h-3" />
                        {t("createPunchItem")}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-sm text-green-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {t("noIssuesDetected")}
                </div>
              )}
              {photoAnalysis.summary && (
                <p className="text-xs text-gray-500 italic">
                  {photoAnalysis.summary}
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Prediction Results — Sprint 27 */}
      {expanded && prediction && (
        <div className="space-y-3">
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
            <div
              className={`ml-auto px-2 py-1 rounded text-xs font-medium ${confidenceColor(prediction.confidenceLevel)}`}
            >
              {prediction.confidenceLevel} {t("confidence")}
            </div>
          </div>

          {prediction.insights.length > 0 && (
            <div className="bg-white rounded-md p-3 space-y-2">
              <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                {t("insights")}
              </div>
              {prediction.insights.map((insight: string, i: number) => (
                <div
                  key={i}
                  className="text-sm text-gray-600 flex items-start gap-2"
                >
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
