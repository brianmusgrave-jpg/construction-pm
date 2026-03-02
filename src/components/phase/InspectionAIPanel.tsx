"use client";

/**
 * @file InspectionAIPanel.tsx
 * @description AI-powered inspection enhancements panel — Sprint 31.
 * Provides inspection readiness check and prep checklist generation.
 * Indigo-themed to complement the inspection section.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  ClipboardCheck,
  ListChecks,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { checkInspectionReadiness, generateInspectionChecklist } from "@/actions/ai-inspection";

interface InspectionAIPanelProps {
  projectId: string;
  phaseId: string;
}

export default function InspectionAIPanel({
  projectId,
  phaseId,
}: InspectionAIPanelProps) {
  const t = useTranslations("inspectionAI");

  const [readiness, setReadiness] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  const [inspectionType, setInspectionType] = useState("");
  const [checklist, setChecklist] = useState<any>(null);
  const [generatingChecklist, setGeneratingChecklist] = useState(false);

  const handleCheckReadiness = async () => {
    setChecking(true);
    setReadiness(null);
    try {
      const result = await checkInspectionReadiness(phaseId, projectId);
      if (result.success && result.readiness) {
        setReadiness(result.readiness);
        toast.success(t("readinessChecked"));
      } else {
        toast.error(result.error || t("checkFailed"));
      }
    } catch {
      toast.error(t("checkFailed"));
    } finally {
      setChecking(false);
    }
  };

  const handleGenerateChecklist = async () => {
    setGeneratingChecklist(true);
    setChecklist(null);
    try {
      const result = await generateInspectionChecklist(
        phaseId,
        projectId,
        inspectionType.trim() || undefined
      );
      if (result.success && result.checklist) {
        setChecklist(result.checklist);
        toast.success(t("checklistGenerated"));
      } else {
        toast.error(result.error || t("generateFailed"));
      }
    } catch {
      toast.error(t("generateFailed"));
    } finally {
      setGeneratingChecklist(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 5) return "text-yellow-600";
    return "text-red-600";
  };

  const priorityBadge = (p: string) => {
    switch (p) {
      case "HIGH": return "bg-red-100 text-red-700";
      case "MEDIUM": return "bg-yellow-100 text-yellow-700";
      case "LOW": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="border border-indigo-200 rounded-lg bg-indigo-50/50 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-indigo-600" />
        <h3 className="font-semibold text-indigo-900">{t("title")}</h3>
      </div>

      {/* Readiness Check */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <ShieldCheck className="w-4 h-4 text-indigo-500" />
          {t("readinessCheck")}
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleCheckReadiness}
            disabled={checking}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            {checking ? t("checking") : t("checkReadiness")}
          </button>
        </div>

        {readiness && (
          <div className="border border-indigo-200 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${scoreColor(readiness.readinessScore)}`}>
                  {readiness.readinessScore}/10
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${readiness.readyForInspection ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {readiness.readyForInspection ? t("ready") : t("notReady")}
                </span>
              </div>
              {readiness.suggestedInspectionType && (
                <span className="text-xs text-indigo-600">{readiness.suggestedInspectionType}</span>
              )}
            </div>

            <p className="text-sm text-gray-600">{readiness.recommendation}</p>

            {readiness.blockers?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {t("blockers")}
                </div>
                {readiness.blockers.map((b: string, i: number) => (
                  <div key={i} className="text-xs text-red-600 pl-4">• {b}</div>
                ))}
              </div>
            )}

            {readiness.warnings?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {t("warnings")}
                </div>
                {readiness.warnings.map((w: string, i: number) => (
                  <div key={i} className="text-xs text-yellow-600 pl-4">• {w}</div>
                ))}
              </div>
            )}

            {readiness.strengths?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {t("strengths")}
                </div>
                {readiness.strengths.map((s: string, i: number) => (
                  <div key={i} className="text-xs text-green-600 pl-4">• {s}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prep Checklist Generator */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <ListChecks className="w-4 h-4 text-indigo-500" />
          {t("checklistGenerator")}
        </div>
        <input
          type="text"
          value={inspectionType}
          onChange={(e) => setInspectionType(e.target.value)}
          placeholder={t("typePlaceholder")}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex justify-end">
          <button
            onClick={handleGenerateChecklist}
            disabled={generatingChecklist}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {generatingChecklist ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
            {generatingChecklist ? t("generating") : t("generateChecklist")}
          </button>
        </div>

        {checklist && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">
              {checklist.inspectionType} — {checklist.items?.length || 0} {t("items")}
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {checklist.items?.map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm border border-indigo-100 rounded-md p-2">
                  <span className={`text-xs px-1 py-0.5 rounded mt-0.5 ${priorityBadge(item.priority)}`}>
                    {item.priority}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{item.task}</div>
                    <div className="text-xs text-gray-500">{item.category}</div>
                    {item.notes && <div className="text-xs text-gray-400 mt-0.5">{item.notes}</div>}
                  </div>
                </div>
              ))}
            </div>

            {checklist.commonFailPoints?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {t("commonFailPoints")}
                </div>
                {checklist.commonFailPoints.map((f: string, i: number) => (
                  <div key={i} className="text-xs text-red-600 pl-4">• {f}</div>
                ))}
              </div>
            )}

            {checklist.documentsNeeded?.length > 0 && (
              <div className="text-xs text-gray-500">
                <span className="font-medium">{t("documentsNeeded")}:</span> {checklist.documentsNeeded.join(", ")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
