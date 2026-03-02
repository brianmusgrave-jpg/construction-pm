"use client";

/**
 * @file ChangeOrderAIPanel.tsx
 * @description AI-powered change order enhancements panel — Sprint 31.
 * Provides CO impact analysis and draft generation.
 * Amber-themed to complement the change order section.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  TrendingUp,
  Wand2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { analyzeChangeOrderImpact, generateChangeOrderDraft } from "@/actions/ai-change-order";

interface ChangeOrderAIPanelProps {
  projectId: string;
  phaseId: string;
  changeOrders: any[];
}

export default function ChangeOrderAIPanel({
  projectId,
  phaseId,
  changeOrders,
}: ChangeOrderAIPanelProps) {
  const t = useTranslations("changeOrderAI");

  const [selectedCOId, setSelectedCOId] = useState("");
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  const handleAnalyze = async () => {
    if (!selectedCOId) return;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const result = await analyzeChangeOrderImpact(selectedCOId, projectId);
      if (result.success && result.analysis) {
        setAnalysis(result.analysis);
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

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setGenerating(true);
    setDraft(null);
    try {
      const result = await generateChangeOrderDraft(description, projectId, phaseId);
      if (result.success && result.draft) {
        setDraft(result.draft);
        toast.success(t("draftGenerated"));
      } else {
        toast.error(result.error || t("generateFailed"));
      }
    } catch {
      toast.error(t("generateFailed"));
    } finally {
      setGenerating(false);
    }
  };

  const impactBadge = (level: string) => {
    switch (level) {
      case "NONE": return "bg-green-100 text-green-700";
      case "MINOR": return "bg-yellow-100 text-yellow-700";
      case "MODERATE": return "bg-orange-100 text-orange-700";
      case "MAJOR": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const riskBadge = (level: string) => {
    switch (level) {
      case "LOW": return "bg-green-100 text-green-700";
      case "MEDIUM": return "bg-yellow-100 text-yellow-700";
      case "HIGH": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="border border-amber-200 rounded-lg bg-amber-50/50 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-amber-600" />
        <h3 className="font-semibold text-amber-900">{t("title")}</h3>
      </div>

      {/* Impact Analysis */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <TrendingUp className="w-4 h-4 text-amber-500" />
          {t("impactAnalysis")}
        </div>

        {changeOrders.length === 0 ? (
          <p className="text-sm text-gray-400 italic">{t("noChangeOrders")}</p>
        ) : (
          <>
            <select
              value={selectedCOId}
              onChange={(e) => { setSelectedCOId(e.target.value); setAnalysis(null); }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">{t("selectCO")}</option>
              {changeOrders.map((co: any) => (
                <option key={co.id} value={co.id}>
                  {co.number}: {co.title} (${co.amount || 0})
                </option>
              ))}
            </select>
            <div className="flex justify-end">
              <button
                onClick={handleAnalyze}
                disabled={analyzing || !selectedCOId}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                {analyzing ? t("analyzing") : t("runAnalysis")}
              </button>
            </div>
          </>
        )}

        {analysis && (
          <div className="border border-amber-200 rounded-md p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-gray-500">{t("schedule")}</div>
                <span className={`text-xs px-1.5 py-0.5 rounded ${impactBadge(analysis.scheduleImpact)}`}>
                  {analysis.scheduleImpact}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-500">{t("budget")}</div>
                <span className={`text-xs px-1.5 py-0.5 rounded ${impactBadge(analysis.budgetImpact)}`}>
                  {analysis.budgetImpact}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-500">{t("scope")}</div>
                <span className={`text-xs px-1.5 py-0.5 rounded ${impactBadge(analysis.scopeImpact)}`}>
                  {analysis.scopeImpact}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Shield className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">{t("overallRisk")}:</span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${riskBadge(analysis.overallRisk)}`}>
                {analysis.overallRisk}
              </span>
            </div>

            <p className="text-sm text-gray-600">{analysis.analysis}</p>

            {analysis.concerns?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {t("concerns")}
                </div>
                {analysis.concerns.map((c: string, i: number) => (
                  <div key={i} className="text-xs text-red-600 pl-4">• {c}</div>
                ))}
              </div>
            )}

            {analysis.recommendations?.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {t("recommendations")}
                </div>
                {analysis.recommendations.map((r: string, i: number) => (
                  <div key={i} className="text-xs text-green-600 pl-4">• {r}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CO Draft Generator */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Wand2 className="w-4 h-4 text-amber-500" />
          {t("draftGenerator")}
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("draftPlaceholder")}
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={generating || !description.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {generating ? t("generating") : t("generateDraft")}
          </button>
        </div>

        {draft && (
          <div className="border border-amber-200 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">{draft.title}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                ${draft.amount?.toLocaleString() || 0}
              </span>
            </div>
            <p className="text-sm text-gray-600">{draft.description}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{t("reason")}: {draft.reason}</span>
            </div>
            {draft.category && (
              <span className="text-xs text-amber-600">{draft.category.replace(/_/g, " ")}</span>
            )}
            {draft.notes && (
              <p className="text-xs text-gray-400 italic">{draft.notes}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
