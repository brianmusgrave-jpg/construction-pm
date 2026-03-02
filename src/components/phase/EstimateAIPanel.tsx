"use client";

/**
 * @file EstimateAIPanel.tsx
 * @description AI-powered estimating enhancements panel — Sprint 29.
 * Features: AI scope-to-estimate generator, estimate review, historical comparison.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  Sparkles,
  ClipboardCheck,
  BarChart3,
  Loader2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import {
  generateEstimateFromScope,
  reviewEstimate,
  compareEstimateHistorical,
} from "@/actions/ai-estimate";
import { addTakeoffItem, createEstimate } from "@/actions/estimate";

interface EstimateAIPanelProps {
  projectId: string;
  phaseId: string;
  estimates: any[];
  onEstimateCreated?: () => void;
}

export default function EstimateAIPanel({
  projectId,
  phaseId,
  estimates,
  onEstimateCreated,
}: EstimateAIPanelProps) {
  const t = useTranslations("estimateAI");

  // Generator state
  const [scope, setScope] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedItems, setGeneratedItems] = useState<any[] | null>(null);
  const [generatedMeta, setGeneratedMeta] = useState<any>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [creating, setCreating] = useState(false);

  // Review state
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<any>(null);
  const [reviewEstimateId, setReviewEstimateId] = useState("");

  // Comparison state
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<any>(null);
  const [compareEstimateId, setCompareEstimateId] = useState("");

  const handleGenerate = async () => {
    if (!scope.trim()) return;
    setGenerating(true);
    setGeneratedItems(null);
    setGeneratedMeta(null);
    try {
      const result = await generateEstimateFromScope(scope, projectId);
      if (result.success && result.items) {
        setGeneratedItems(result.items);
        setGeneratedMeta({
          totalEstimate: result.totalEstimate,
          confidence: result.confidence,
          notes: result.notes,
        });
        toast.success(t("generated"));
      } else {
        toast.error(result.error || t("generateFailed"));
      }
    } catch {
      toast.error(t("generateFailed"));
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateFromAI = async () => {
    if (!generatedItems || generatedItems.length === 0) return;
    setCreating(true);
    try {
      // Create a new estimate
      const est = await createEstimate({
        phaseId,
        name: `AI Estimate: ${scope.slice(0, 50)}${scope.length > 50 ? "..." : ""}`,
        description: `Generated from scope: ${scope}`,
      });

      // Add all generated items
      for (const item of generatedItems) {
        await addTakeoffItem({
          estimateId: est.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          category: item.category,
        });
      }

      toast.success(t("estimateCreated"));
      setGeneratedItems(null);
      setGeneratedMeta(null);
      setScope("");
      setShowGenerator(false);
      if (onEstimateCreated) onEstimateCreated();
    } catch {
      toast.error(t("createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const handleReview = async () => {
    if (!reviewEstimateId) return;
    setReviewing(true);
    setReview(null);
    try {
      const result = await reviewEstimate(reviewEstimateId, projectId);
      if (result.success && result.review) {
        setReview(result.review);
        toast.success(t("reviewed"));
      } else {
        toast.error(result.error || t("reviewFailed"));
      }
    } catch {
      toast.error(t("reviewFailed"));
    } finally {
      setReviewing(false);
    }
  };

  const handleCompare = async () => {
    if (!compareEstimateId) return;
    setComparing(true);
    setComparison(null);
    try {
      const result = await compareEstimateHistorical(compareEstimateId, projectId);
      if (result.success && result.comparison) {
        setComparison(result.comparison);
        toast.success(t("compared"));
      } else {
        toast.error(result.error || t("compareFailed"));
      }
    } catch {
      toast.error(t("compareFailed"));
    } finally {
      setComparing(false);
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

  const assessmentIcon = (assessment: string) => {
    switch (assessment) {
      case "ABOVE_AVERAGE": return <TrendingUp className="w-4 h-4 text-red-500" />;
      case "BELOW_AVERAGE": return <TrendingDown className="w-4 h-4 text-blue-500" />;
      default: return <Minus className="w-4 h-4 text-green-500" />;
    }
  };

  return (
    <div className="border border-emerald-200 rounded-lg bg-emerald-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-emerald-900">{t("title")}</h3>
        </div>
        <button
          onClick={() => setShowGenerator(!showGenerator)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          {t("generateEstimate")}
        </button>
      </div>

      {/* AI Estimate Generator */}
      {showGenerator && (
        <div className="bg-white rounded-md p-3 space-y-3">
          <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            {t("scopeToEstimate")}
          </div>
          <textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder={t("scopePlaceholder")}
            rows={3}
            className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowGenerator(false); setGeneratedItems(null); }}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || !scope.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? t("generating") : t("generate")}
            </button>
          </div>

          {/* Generated Items */}
          {generatedItems && generatedItems.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {t("generatedItems")} ({generatedItems.length})
                </span>
                {generatedMeta?.confidence && (
                  <span className={`text-xs px-2 py-0.5 rounded ${confidenceColor(generatedMeta.confidence)}`}>
                    {generatedMeta.confidence} {t("confidence")}
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="text-left p-1.5">{t("description")}</th>
                      <th className="text-right p-1.5">{t("qty")}</th>
                      <th className="text-left p-1.5">{t("unit")}</th>
                      <th className="text-right p-1.5">{t("unitCost")}</th>
                      <th className="text-right p-1.5">{t("total")}</th>
                      <th className="text-left p-1.5">{t("category")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedItems.map((item: any, i: number) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="p-1.5">{item.description}</td>
                        <td className="text-right p-1.5">{item.quantity}</td>
                        <td className="p-1.5">{item.unit}</td>
                        <td className="text-right p-1.5">${Number(item.unitCost).toLocaleString()}</td>
                        <td className="text-right p-1.5 font-medium">${Number(item.totalCost).toLocaleString()}</td>
                        <td className="p-1.5 text-gray-500">{item.category}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={4} className="p-1.5 text-right">{t("estimateTotal")}:</td>
                      <td className="text-right p-1.5">${Number(generatedMeta?.totalEstimate || 0).toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {generatedMeta?.notes && (
                <p className="text-xs text-gray-500 italic">{generatedMeta.notes}</p>
              )}

              <button
                onClick={handleCreateFromAI}
                disabled={creating}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {creating ? t("creatingEstimate") : t("createEstimateFromAI")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Estimate Review & Comparison — only show if estimates exist */}
      {estimates.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* AI Review */}
          <div className="bg-white rounded-md p-3 space-y-2">
            <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-500" />
              {t("reviewEstimate")}
            </div>
            <select
              value={reviewEstimateId}
              onChange={(e) => { setReviewEstimateId(e.target.value); setReview(null); }}
              className="w-full border rounded-md px-2 py-1.5 text-sm"
            >
              <option value="">{t("selectEstimate")}</option>
              {estimates.map((est: any) => (
                <option key={est.id} value={est.id}>
                  {est.name} (${Number(est.totalCost).toLocaleString()})
                </option>
              ))}
            </select>
            <button
              onClick={handleReview}
              disabled={reviewing || !reviewEstimateId}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
              {reviewing ? t("reviewingEstimate") : t("runReview")}
            </button>

            {review && (
              <div className="space-y-2 border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{t("overallScore")}</span>
                  <span className={`text-lg font-bold ${review.overallScore >= 7 ? "text-green-600" : review.overallScore >= 4 ? "text-yellow-600" : "text-red-600"}`}>
                    {review.overallScore}/10
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{t("completeness")}:</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${confidenceColor(review.completeness)}`}>
                    {review.completeness}
                  </span>
                </div>
                {review.missingItems.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {t("missingItems")}
                    </div>
                    {review.missingItems.map((item: string, i: number) => (
                      <div key={i} className="text-xs text-gray-600 ml-4">• {item}</div>
                    ))}
                  </div>
                )}
                {review.concerns.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-yellow-600">{t("concerns")}</div>
                    {review.concerns.map((c: string, i: number) => (
                      <div key={i} className="text-xs text-gray-600 ml-4">• {c}</div>
                    ))}
                  </div>
                )}
                {review.suggestions.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {t("suggestions")}
                    </div>
                    {review.suggestions.map((s: string, i: number) => (
                      <div key={i} className="text-xs text-gray-600 ml-4">• {s}</div>
                    ))}
                  </div>
                )}
                {review.costAssessment && (
                  <p className="text-xs text-gray-500 italic">{review.costAssessment}</p>
                )}
              </div>
            )}
          </div>

          {/* Historical Comparison */}
          <div className="bg-white rounded-md p-3 space-y-2">
            <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-500" />
              {t("historicalComparison")}
            </div>
            <select
              value={compareEstimateId}
              onChange={(e) => { setCompareEstimateId(e.target.value); setComparison(null); }}
              className="w-full border rounded-md px-2 py-1.5 text-sm"
            >
              <option value="">{t("selectEstimate")}</option>
              {estimates.map((est: any) => (
                <option key={est.id} value={est.id}>
                  {est.name} (${Number(est.totalCost).toLocaleString()})
                </option>
              ))}
            </select>
            <button
              onClick={handleCompare}
              disabled={comparing || !compareEstimateId}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {comparing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              {comparing ? t("comparingEstimate") : t("runComparison")}
            </button>

            {comparison && (
              <div className="space-y-2 border-t pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">${comparison.currentTotal.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">{t("currentEstimate")}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-600">${comparison.historicalAvg.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">{t("historicalAvg")}</div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2">
                  {assessmentIcon(comparison.assessment)}
                  <span className={`text-sm font-medium ${
                    comparison.assessment === "ABOVE_AVERAGE" ? "text-red-600" :
                    comparison.assessment === "BELOW_AVERAGE" ? "text-blue-600" :
                    "text-green-600"
                  }`}>
                    {comparison.percentDiff > 0 ? "+" : ""}{comparison.percentDiff}% {t("vsAverage")}
                  </span>
                </div>
                {comparison.comparedPhases > 0 && (
                  <div className="text-xs text-gray-500 text-center">
                    {t("range")}: ${comparison.historicalMin.toLocaleString()} — ${comparison.historicalMax.toLocaleString()}
                  </div>
                )}
                {comparison.insights.map((insight: string, i: number) => (
                  <div key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                    {insight}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
