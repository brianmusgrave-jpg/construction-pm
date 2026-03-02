"use client";

/**
 * @file RFIAIPanel.tsx
 * @description AI-powered RFI enhancements panel — Sprint 30.
 * Provides AI RFI draft generation and response suggestion features.
 * Blue-themed to match the RFI section's MessageSquareText icon color.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Brain,
  Wand2,
  MessageSquareReply,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { generateRFIDraft, suggestRFIResponse } from "@/actions/ai-rfi";

interface RFIAIPanelProps {
  projectId: string;
  phaseId: string;
  rfis: any[];
  onDraftReady?: (data: { subject: string; question: string; priority: string; ballInCourt: string }) => void;
}

export default function RFIAIPanel({
  projectId,
  phaseId,
  rfis,
  onDraftReady,
}: RFIAIPanelProps) {
  const t = useTranslations("rfiAI");

  // Draft generator state
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  // Response suggestion state
  const [selectedRfiId, setSelectedRfiId] = useState("");
  const [suggestion, setSuggestion] = useState<any>(null);
  const [suggesting, setSuggesting] = useState(false);

  const openRfis = rfis.filter((r: any) => r.status === "OPEN");

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setGenerating(true);
    setDraft(null);
    try {
      const result = await generateRFIDraft(description, projectId, phaseId);
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

  const handleSuggest = async () => {
    if (!selectedRfiId) return;
    setSuggesting(true);
    setSuggestion(null);
    try {
      const result = await suggestRFIResponse(selectedRfiId, projectId);
      if (result.success && result.suggestion) {
        setSuggestion(result.suggestion);
        toast.success(t("responseSuggested"));
      } else {
        toast.error(result.error || t("suggestFailed"));
      }
    } catch {
      toast.error(t("suggestFailed"));
    } finally {
      setSuggesting(false);
    }
  };

  const handleCopyAnswer = () => {
    if (suggestion?.answer) {
      navigator.clipboard.writeText(suggestion.answer);
      toast.success(t("copiedToClipboard"));
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

  const priorityColor = (p: string) => {
    switch (p) {
      case "URGENT": return "bg-red-100 text-red-700";
      case "HIGH": return "bg-orange-100 text-orange-700";
      case "NORMAL": return "bg-blue-100 text-blue-700";
      case "LOW": return "bg-gray-100 text-gray-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50/50 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-blue-900">{t("title")}</h3>
      </div>

      {/* AI RFI Draft Generator */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Wand2 className="w-4 h-4 text-blue-500" />
          {t("draftGenerator")}
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("draftPlaceholder")}
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={generating || !description.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            {generating ? t("generating") : t("generateDraft")}
          </button>
        </div>

        {draft && (
          <div className="border border-blue-200 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">{draft.subject}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${priorityColor(draft.priority)}`}>
                {draft.priority}
              </span>
            </div>
            <p className="text-sm text-gray-600">{draft.question}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{t("ballInCourt")}: <strong>{draft.ballInCourt}</strong></span>
            </div>
            {draft.context && (
              <p className="text-xs text-gray-400 italic">{draft.context}</p>
            )}
            {onDraftReady && (
              <button
                onClick={() => onDraftReady({
                  subject: draft.subject,
                  question: draft.question,
                  priority: draft.priority,
                  ballInCourt: draft.ballInCourt,
                })}
                className="mt-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {t("useThisDraft")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* AI Response Suggestion */}
      <div className="bg-white rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <MessageSquareReply className="w-4 h-4 text-blue-500" />
          {t("responseSuggestion")}
        </div>

        {openRfis.length === 0 ? (
          <p className="text-sm text-gray-400 italic">{t("noOpenRFIs")}</p>
        ) : (
          <>
            <select
              value={selectedRfiId}
              onChange={(e) => {
                setSelectedRfiId(e.target.value);
                setSuggestion(null);
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">{t("selectRFI")}</option>
              {openRfis.map((rfi: any) => (
                <option key={rfi.id} value={rfi.id}>
                  RFI-{String(rfi.rfiNumber).padStart(3, "0")}: {rfi.subject}
                </option>
              ))}
            </select>
            <div className="flex justify-end">
              <button
                onClick={handleSuggest}
                disabled={suggesting || !selectedRfiId}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {suggesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquareReply className="w-4 h-4" />
                )}
                {suggesting ? t("suggesting") : t("suggestResponse")}
              </button>
            </div>
          </>
        )}

        {suggestion && (
          <div className="border border-blue-200 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{t("suggestedAnswer")}</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${confidenceColor(suggestion.confidence)}`}>
                  {suggestion.confidence}
                </span>
                <button
                  onClick={handleCopyAnswer}
                  className="text-gray-400 hover:text-blue-600"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{suggestion.answer}</p>

            {suggestion.references.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {t("references")}
                </div>
                {suggestion.references.map((ref: string, i: number) => (
                  <div key={i} className="text-xs text-gray-500 pl-4">• {ref}</div>
                ))}
              </div>
            )}

            {suggestion.caveats.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t("caveats")}
                </div>
                {suggestion.caveats.map((c: string, i: number) => (
                  <div key={i} className="text-xs text-yellow-600 pl-4">• {c}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
