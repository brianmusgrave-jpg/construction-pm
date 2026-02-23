"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  DollarSign,
  Hash,
  Tag,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface ExtractedData {
  extractedAt: string;
  method: string;
  confidence: number;
  fileExtension: string;
  detectedDates: string[];
  detectedAmounts: string[];
  refNumbers: string[];
  detectedKeywords: string[];
  hints: string[];
  summary: string;
  note?: string;
}

interface DocumentAIPanelProps {
  documentId: string;
  initialData?: ExtractedData | null;
}

export function DocumentAIPanel({ documentId, initialData }: DocumentAIPanelProps) {
  const [data, setData] = useState<ExtractedData | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!!initialData);

  const runExtraction = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/extract`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Extraction failed");
      const json = await res.json();
      setData(json.extractedData as ExtractedData);
      setExpanded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to extract");
    } finally {
      setLoading(false);
    }
  };

  const confidenceColor =
    !data
      ? ""
      : data.confidence >= 70
      ? "text-green-600"
      : data.confidence >= 50
      ? "text-amber-600"
      : "text-red-500";

  return (
    <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden">
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => data && setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-xs font-semibold text-gray-700">AI Extraction</span>
          {data && (
            <span className={`text-xs font-medium ${confidenceColor}`}>
              {data.confidence}% confidence
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              runExtraction();
            }}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded transition-colors disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {data ? "Re-run" : "Extract"}
          </button>
          {data &&
            (expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-red-50 text-xs text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      {data && expanded && (
        <div className="px-3 py-3 space-y-3 text-xs">
          {/* Summary */}
          <div className="flex items-start gap-1.5 text-gray-600">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
            <span>{data.summary}</span>
          </div>

          {/* Dates */}
          {data.detectedDates.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-gray-500 mb-1">
                <Calendar className="w-3 h-3" />
                <span className="font-medium uppercase tracking-wide text-[10px]">Dates</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {data.detectedDates.map((d, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-mono"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Amounts */}
          {data.detectedAmounts.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-gray-500 mb-1">
                <DollarSign className="w-3 h-3" />
                <span className="font-medium uppercase tracking-wide text-[10px]">Amounts</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {data.detectedAmounts.map((a, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-mono"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reference numbers */}
          {data.refNumbers.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-gray-500 mb-1">
                <Hash className="w-3 h-3" />
                <span className="font-medium uppercase tracking-wide text-[10px]">
                  Reference Numbers
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {data.refNumbers.map((r, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded font-mono"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Keywords */}
          {data.detectedKeywords.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-gray-500 mb-1">
                <Tag className="w-3 h-3" />
                <span className="font-medium uppercase tracking-wide text-[10px]">Keywords</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {data.detectedKeywords.map((k, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded capitalize"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hints */}
          {data.hints.length > 0 && (
            <div className="border-t border-gray-100 pt-2">
              <p className="font-medium text-gray-500 uppercase tracking-wide text-[10px] mb-1">
                Suggestions
              </p>
              <ul className="space-y-0.5">
                {data.hints.map((h, i) => (
                  <li key={i} className="text-gray-600 flex items-start gap-1">
                    <span className="text-purple-400 shrink-0">›</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer */}
          <p className="text-[10px] text-gray-400 border-t border-gray-100 pt-2">
            Extracted {new Date(data.extractedAt).toLocaleString()} · {data.method}
            {data.note && ` · ${data.note}`}
          </p>
        </div>
      )}
    </div>
  );
}
