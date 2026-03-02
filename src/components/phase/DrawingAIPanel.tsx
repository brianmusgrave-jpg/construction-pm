"use client";

/**
 * @file DrawingAIPanel.tsx
 * @description AI-powered drawing intelligence panel — Sprint 33.
 * Provides revision change analysis and drawing set completeness checking.
 * Violet-themed to complement the drawing section.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  GitCompare,
  ClipboardCheck,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { analyzeRevisionChanges, checkDrawingSetCompleteness } from "@/actions/ai-drawing";

interface DrawingAIPanelProps {
  projectId: string;
  phaseId: string;
  drawings: any[];
}

export default function DrawingAIPanel({
  projectId,
  phaseId,
  drawings,
}: DrawingAIPanelProps) {
  const t = useTranslations("drawingAI");

  const [selectedDrawingId, setSelectedDrawingId] = useState("");
  const [revision, setRevision] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [completeness, setCompleteness] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  const handleAnalyzeRevision = async () => {
    if (!selectedDrawingId) return;
    setAnalyzing(true);
    setRevision(null);
    try {
      const result = await analyzeRevisionChanges(selectedDrawingId, projectId);
      if (result.success && result.analysis) {
        setRevision(result.analysis);
        toast.success(t("analyzed"));
      } else {
        toast.error(result.error || t("analyzeFailed"));
      }
    } catch {
      toast.error(t("analyzeFailed"));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCheckCompleteness = async () => {
    setChecking(true);
    setCompleteness(null);
    try {
      const result = await checkDrawingSetCompleteness(phaseId, projectId);
      if (result.success && result.completeness) {
        setCompleteness(result.completeness);
        toast.success(t("checked"));
      } else {
        toast.error(result.error || t("checkFailed"));
      }
    } catch {
      toast.error(t("checkFailed"));
    } finally {
      setChecking(false);
    }
  };

  const impactBadge = (level: string) => {
    switch (level) {
      case "HIGH": return "bg-red-100 text-red-700";
      case "MEDIUM": return "bg-yellow-100 text-yellow-700";
      case "LOW": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const assessmentBadge = (a: string) => {
    switch (a) {
      case "ADEQUATE": return "bg-green-100 text-green-700";
      case "NEEDS_MORE": return "bg-yellow-100 text-yellow-700";
      case "MISSING": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "COMPLETE": return "bg-green-100 text-green-700";
      case "MOSTLY_COMPLETE": return "bg-blue-100 text-blue-700";
      case "INCOMPLETE": return "bg-yellow-100 text-yellow-700";
      case "CRITICAL_GAPS": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="border border-violet-200 rounded-lg bg-violet-50/50 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-violet-600" />
        <h3 className="font-semibold text-violet-900">{t("title")}</h3>
      </div>

      {/* Revision Change Analysis */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <GitCompare className="w-4 h-4 text-violet-500" />
          {t("revisionAnalysis")}
        </div>

        {drawings.length === 0 ? (
          <p className="text-sm text-gray-400 italic">{t("noDrawings")}</p>
        ) : (
          <>
            <div className="flex gap-2">
              <select
                value={selectedDrawingId}
                onChange={(e) => setSelectedDrawingId(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">{t("selectDrawing")}</option>
                {drawings.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.drawingNumber} — {d.title} (Rev {d.revision})
                  </option>
                ))}
              </select>
              <button
                onClick={handleAnalyzeRevision}
                disabled={analyzing || !selectedDrawingId}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
                {analyzing ? t("analyzing") : t("analyze")}
              </button>
            </div>
          </>
        )}

        {revision && (
          <div className="border border-violet-200 rounded-md p-3 space-y-2">
            {revision.changesSummary && (
              <p className="text-sm text-gray-600">{revision.changesSummary}</p>
            )}

            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">{t("rfiRisk")}:</span>
              <span className={`px-1.5 py-0.5 rounded ${impactBadge(revision.rfiRisk)}`}>
                {revision.rfiRisk}
              </span>
              {revision.rfiRiskReason && (
                <span className="text-gray-400 italic">{revision.rfiRiskReason}</span>
              )}
            </div>

            {revision.impactAreas?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-violet-600">{t("impactAreas")}</div>
                {revision.impactAreas.map((area: any, i: number) => (
                  <div key={i} className="text-xs flex items-start gap-2 bg-gray-50 rounded px-2 py-1">
                    <span className={`px-1 py-0 rounded shrink-0 ${impactBadge(area.impact)}`}>{area.impact}</span>
                    <div>
                      <span className="font-medium text-gray-700">{area.area}</span>
                      <div className="text-gray-500">{area.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {revision.coordinationNeeded?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {t("coordinationNeeded")}
                </div>
                {revision.coordinationNeeded.map((c: string, i: number) => (
                  <div key={i} className="text-xs text-amber-600 pl-4">• {c}</div>
                ))}
              </div>
            )}

            {revision.recommendations?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {t("recommendations")}
                </div>
                {revision.recommendations.map((r: string, i: number) => (
                  <div key={i} className="text-xs text-green-600 pl-4">• {r}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawing Set Completeness Check */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <ClipboardCheck className="w-4 h-4 text-violet-500" />
          {t("completenessCheck")}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleCheckCompleteness}
            disabled={checking || drawings.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            {checking ? t("checking") : t("check")}
          </button>
        </div>

        {completeness && (
          <div className="border border-violet-200 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-2xl font-bold ${completeness.completenessScore >= 7 ? "text-green-600" : completeness.completenessScore >= 4 ? "text-yellow-600" : "text-red-600"}`}>
                {completeness.completenessScore}/10
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${statusBadge(completeness.status)}`}>
                {completeness.status}
              </span>
            </div>

            {completeness.disciplineCoverage?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-violet-600">{t("disciplineCoverage")}</div>
                {completeness.disciplineCoverage.map((dc: any, i: number) => (
                  <div key={i} className="text-xs flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                    <span className="font-medium text-gray-700">{dc.discipline}</span>
                    <span className="text-gray-500">{dc.drawingCount} {t("drawings")}</span>
                    <span className={`px-1 py-0 rounded ${assessmentBadge(dc.assessment)}`}>{dc.assessment}</span>
                  </div>
                ))}
              </div>
            )}

            {completeness.missingDrawings?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {t("missingDrawings")}
                </div>
                {completeness.missingDrawings.map((md: any, i: number) => (
                  <div key={i} className="text-xs pl-4 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span className={`px-1 py-0 rounded ${impactBadge(md.priority)}`}>{md.priority}</span>
                      <span className="font-medium text-gray-700">{md.suggestedNumber} — {md.title}</span>
                    </div>
                    <div className="text-gray-500 pl-2">{md.discipline} — {md.reason}</div>
                  </div>
                ))}
              </div>
            )}

            {completeness.versioningIssues?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-amber-600">{t("versioningIssues")}</div>
                {completeness.versioningIssues.map((v: string, i: number) => (
                  <div key={i} className="text-xs text-amber-600 pl-4">• {v}</div>
                ))}
              </div>
            )}

            {completeness.recommendations?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {t("recommendations")}
                </div>
                {completeness.recommendations.map((r: string, i: number) => (
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
