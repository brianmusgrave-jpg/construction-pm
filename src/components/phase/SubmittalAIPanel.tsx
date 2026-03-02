"use client";

/**
 * @file SubmittalAIPanel.tsx
 * @description AI-powered submittal enhancements panel — Sprint 30.
 * Provides submittal completeness checking and package generation.
 * Teal-themed to complement the submittal section's FileCheck2 icon.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  ClipboardCheck,
  Package,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Plus,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { checkSubmittalCompleteness, generateSubmittalPackage } from "@/actions/ai-submittal";
import { createSubmittal } from "@/actions/submittal";

interface SubmittalAIPanelProps {
  projectId: string;
  phaseId: string;
  submittals: any[];
  onSubmittalCreated?: () => void;
}

export default function SubmittalAIPanel({
  projectId,
  phaseId,
  submittals,
  onSubmittalCreated,
}: SubmittalAIPanelProps) {
  const t = useTranslations("submittalAI");

  // Completeness check state
  const [selectedSubmittalId, setSelectedSubmittalId] = useState("");
  const [review, setReview] = useState<any>(null);
  const [reviewing, setReviewing] = useState(false);

  // Package generator state
  const [scope, setScope] = useState("");
  const [pkg, setPkg] = useState<any>(null);
  const [generatingPkg, setGeneratingPkg] = useState(false);
  const [creatingItems, setCreatingItems] = useState(false);

  const handleCheck = async () => {
    if (!selectedSubmittalId) return;
    setReviewing(true);
    setReview(null);
    try {
      const result = await checkSubmittalCompleteness(selectedSubmittalId, projectId);
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

  const handleGeneratePackage = async () => {
    if (!scope.trim()) return;
    setGeneratingPkg(true);
    setPkg(null);
    try {
      const result = await generateSubmittalPackage(scope, projectId, phaseId);
      if (result.success && result.package) {
        setPkg(result.package);
        toast.success(t("packageGenerated"));
      } else {
        toast.error(result.error || t("generateFailed"));
      }
    } catch {
      toast.error(t("generateFailed"));
    } finally {
      setGeneratingPkg(false);
    }
  };

  const handleCreateFromPackage = async () => {
    if (!pkg?.items?.length) return;
    setCreatingItems(true);
    try {
      for (const item of pkg.items) {
        await createSubmittal({
          phaseId,
          title: item.title,
          specSection: item.specSection || undefined,
          description: `${item.description}\n\nRequired docs: ${item.requiredDocs?.join(", ") || "N/A"}`,
        });
      }
      toast.success(t("submittalsCreated"));
      setPkg(null);
      setScope("");
      onSubmittalCreated?.();
    } catch {
      toast.error(t("createFailed"));
    } finally {
      setCreatingItems(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 5) return "text-yellow-600";
    return "text-red-600";
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "COMPLETE": return "bg-green-100 text-green-700";
      case "NEEDS_REVISION": return "bg-yellow-100 text-yellow-700";
      case "INCOMPLETE": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
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
    <div className="border border-teal-200 rounded-lg bg-teal-50/50 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-teal-600" />
        <h3 className="font-semibold text-teal-900">{t("title")}</h3>
      </div>

      {/* Completeness Check */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <ClipboardCheck className="w-4 h-4 text-teal-500" />
          {t("completenessCheck")}
        </div>

        {submittals.length === 0 ? (
          <p className="text-sm text-gray-400 italic">{t("noSubmittals")}</p>
        ) : (
          <>
            <select
              value={selectedSubmittalId}
              onChange={(e) => {
                setSelectedSubmittalId(e.target.value);
                setReview(null);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">{t("selectSubmittal")}</option>
              {submittals.map((s: any) => (
                <option key={s.id} value={s.id}>
                  SUB-{String(s.submittalNumber).padStart(3, "0")}: {s.title}
                </option>
              ))}
            </select>
            <div className="flex justify-end">
              <button
                onClick={handleCheck}
                disabled={reviewing || !selectedSubmittalId}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {reviewing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="w-4 h-4" />
                )}
                {reviewing ? t("reviewing") : t("runCheck")}
              </button>
            </div>
          </>
        )}

        {review && (
          <div className="border border-teal-200 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${scoreColor(review.score)}`}>
                  {review.score}/10
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${statusBadge(review.status)}`}>
                  {review.status.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            {review.specCompliance && (
              <p className="text-sm text-gray-600">{review.specCompliance}</p>
            )}

            {review.missingElements.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t("missingElements")}
                </div>
                {review.missingElements.map((item: string, i: number) => (
                  <div key={i} className="text-xs text-red-600 pl-4">• {item}</div>
                ))}
              </div>
            )}

            {review.concerns.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t("concerns")}
                </div>
                {review.concerns.map((c: string, i: number) => (
                  <div key={i} className="text-xs text-yellow-600 pl-4">• {c}</div>
                ))}
              </div>
            )}

            {review.recommendations.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {t("recommendations")}
                </div>
                {review.recommendations.map((r: string, i: number) => (
                  <div key={i} className="text-xs text-green-600 pl-4">• {r}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submittal Package Generator */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Package className="w-4 h-4 text-teal-500" />
          {t("packageGenerator")}
        </div>
        <textarea
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder={t("scopePlaceholder")}
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <div className="flex justify-end">
          <button
            onClick={handleGeneratePackage}
            disabled={generatingPkg || !scope.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {generatingPkg ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Package className="w-4 h-4" />
            )}
            {generatingPkg ? t("generating") : t("generatePackage")}
          </button>
        </div>

        {pkg && pkg.items.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">
              {t("generatedItems")} ({pkg.items.length})
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {pkg.items.map((item: any, i: number) => (
                <div key={i} className="border border-teal-100 rounded-md p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{item.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${priorityBadge(item.priority)}`}>
                      {item.priority}
                    </span>
                  </div>
                  {item.specSection && (
                    <div className="text-xs text-teal-600 mt-0.5">
                      <FileText className="w-3 h-3 inline mr-1" />
                      {item.specSection}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                  {item.requiredDocs?.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">
                      {t("requiredDocs")}: {item.requiredDocs.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {pkg.notes && (
              <p className="text-xs text-gray-400 italic">{pkg.notes}</p>
            )}
            <button
              onClick={handleCreateFromPackage}
              disabled={creatingItems}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {creatingItems ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {creatingItems ? t("creatingSubmittals") : t("createAllSubmittals")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
