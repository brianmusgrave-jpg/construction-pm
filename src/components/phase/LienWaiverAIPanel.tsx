"use client";

/**
 * @file LienWaiverAIPanel.tsx
 * @description AI-powered lien waiver intelligence panel — Sprint 32.
 * Provides compliance checking and payment-waiver gap analysis.
 * Indigo-themed to match the LienWaiverSection's ShieldCheck icon color.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  ShieldCheck,
  Scale,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { checkWaiverCompliance, analyzePaymentWaiverGaps } from "@/actions/ai-lien-waiver";

interface LienWaiverAIPanelProps {
  projectId: string;
  phaseId: string;
  waivers: any[];
}

export default function LienWaiverAIPanel({
  projectId,
  phaseId,
  waivers,
}: LienWaiverAIPanelProps) {
  const t = useTranslations("lienWaiverAI");

  const [compliance, setCompliance] = useState<any>(null);
  const [checkingCompliance, setCheckingCompliance] = useState(false);

  const [gapAnalysis, setGapAnalysis] = useState<any>(null);
  const [analyzingGaps, setAnalyzingGaps] = useState(false);

  const handleCheckCompliance = async () => {
    setCheckingCompliance(true);
    setCompliance(null);
    try {
      const result = await checkWaiverCompliance(phaseId, projectId);
      if (result.success && result.compliance) {
        setCompliance(result.compliance);
        toast.success(t("complianceChecked"));
      } else {
        toast.error(result.error || t("complianceFailed"));
      }
    } catch {
      toast.error(t("complianceFailed"));
    } finally {
      setCheckingCompliance(false);
    }
  };

  const handleAnalyzeGaps = async () => {
    setAnalyzingGaps(true);
    setGapAnalysis(null);
    try {
      const result = await analyzePaymentWaiverGaps(phaseId, projectId);
      if (result.success && result.gapAnalysis) {
        setGapAnalysis(result.gapAnalysis);
        toast.success(t("gapsAnalyzed"));
      } else {
        toast.error(result.error || t("gapsFailed"));
      }
    } catch {
      toast.error(t("gapsFailed"));
    } finally {
      setAnalyzingGaps(false);
    }
  };

  const complianceBadge = (level: string) => {
    switch (level) {
      case "COMPLIANT": return "bg-green-100 text-green-700";
      case "PARTIAL": return "bg-yellow-100 text-yellow-700";
      case "NON_COMPLIANT": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const severityBadge = (s: string) => {
    switch (s) {
      case "HIGH": return "bg-red-100 text-red-700";
      case "MEDIUM": return "bg-yellow-100 text-yellow-700";
      case "LOW": return "bg-blue-100 text-blue-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const gapBadge = (level: string) => {
    switch (level) {
      case "NONE": return "bg-green-100 text-green-700";
      case "MINOR": return "bg-blue-100 text-blue-700";
      case "MODERATE": return "bg-yellow-100 text-yellow-700";
      case "CRITICAL": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="border border-indigo-200 rounded-lg bg-indigo-50/50 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-indigo-600" />
        <h3 className="font-semibold text-indigo-900">{t("title")}</h3>
      </div>

      {/* Compliance Check */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <ShieldCheck className="w-4 h-4 text-indigo-500" />
          {t("complianceCheck")}
        </div>

        {waivers.length === 0 ? (
          <p className="text-sm text-gray-400 italic">{t("noWaivers")}</p>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={handleCheckCompliance}
              disabled={checkingCompliance}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {checkingCompliance ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {checkingCompliance ? t("checking") : t("checkCompliance")}
            </button>
          </div>
        )}

        {compliance && (
          <div className="border border-indigo-200 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${compliance.complianceScore >= 7 ? "text-green-600" : compliance.complianceScore >= 4 ? "text-yellow-600" : "text-red-600"}`}>
                  {compliance.complianceScore}/10
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${complianceBadge(compliance.overallCompliance)}`}>
                  {compliance.overallCompliance}
                </span>
              </div>
            </div>

            {compliance.summary && (
              <p className="text-sm text-gray-600">{compliance.summary}</p>
            )}

            {compliance.issues?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-red-600 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> {t("issues")}
                </div>
                {compliance.issues.map((item: any, i: number) => (
                  <div key={i} className="text-xs pl-4 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span className={`px-1 py-0 rounded ${severityBadge(item.severity)}`}>{item.severity}</span>
                      <span className="font-medium text-gray-700">{item.vendor}</span>
                    </div>
                    <div className="text-gray-500 pl-2">{item.issue}</div>
                    <div className="text-indigo-600 pl-2">→ {item.recommendation}</div>
                  </div>
                ))}
              </div>
            )}

            {compliance.bestPractices?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {t("bestPractices")}
                </div>
                {compliance.bestPractices.map((r: string, i: number) => (
                  <div key={i} className="text-xs text-green-600 pl-4">• {r}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment-Waiver Gap Analysis */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Scale className="w-4 h-4 text-indigo-500" />
          {t("gapAnalysis")}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleAnalyzeGaps}
            disabled={analyzingGaps}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {analyzingGaps ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
            {analyzingGaps ? t("analyzing") : t("analyzeGaps")}
          </button>
        </div>

        {gapAnalysis && (
          <div className="border border-indigo-200 rounded-md p-3 space-y-2">
            <div className="flex items-center gap-3">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${gapBadge(gapAnalysis.gapSeverity)}`}>
                {gapAnalysis.gapSeverity} {t("gaps")}
              </span>
              {gapAnalysis.uncoveredAmount > 0 && (
                <span className="text-sm font-bold text-red-600">
                  ${gapAnalysis.uncoveredAmount.toLocaleString()} {t("uncovered")}
                </span>
              )}
            </div>

            {gapAnalysis.summary && (
              <p className="text-sm text-gray-600">{gapAnalysis.summary}</p>
            )}

            {gapAnalysis.gaps?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {t("identifiedGaps")}
                </div>
                {gapAnalysis.gaps.map((gap: any, i: number) => (
                  <div key={i} className="text-xs pl-4 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span className="px-1 py-0 rounded bg-amber-100 text-amber-700">{gap.type}</span>
                      {gap.affectedVendor && <span className="text-gray-600">{gap.affectedVendor}</span>}
                    </div>
                    <div className="text-gray-500 pl-2">{gap.description}</div>
                    <div className="text-indigo-600 pl-2">→ {gap.recommendation}</div>
                  </div>
                ))}
              </div>
            )}

            {gapAnalysis.recommendations?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {t("recommendations")}
                </div>
                {gapAnalysis.recommendations.map((r: string, i: number) => (
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
