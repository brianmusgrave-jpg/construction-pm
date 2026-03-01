"use client";

/**
 * @file components/phase/DocumentAIPanel.tsx
 * @description Collapsible AI data-extraction panel rendered below each
 *   document row in `DocumentSection`.
 *
 * Calls `POST /api/documents/:id/extract` to run server-side extraction,
 * then surfaces the structured result (`ExtractedData`) including:
 *   - `summary` — natural language description
 *   - `detectedDates` — date strings found in the document
 *   - `detectedAmounts` — monetary values detected
 *   - `refNumbers` — reference/PO/invoice numbers
 *   - `detectedKeywords` — domain-relevant keywords
 *   - `hints` — AI suggestions for follow-up actions
 *   - `confidence` — 0–100 score (green ≥70, amber ≥50, red <50)
 *
 * The panel is collapsed by default; it expands automatically after a
 * successful extraction or if `initialData` is provided. The user can
 * toggle expansion and re-run extraction at any time.
 *
 * API routes: `POST /api/documents/[id]/extract`.
 * i18n: none.
 */

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
  ShieldCheck,
  FolderSearch,
  FileWarning,
} from "lucide-react";
import {
  classifyDocument,
  extractCOIFields,
  detectDocumentConflicts,
} from "@/actions/ai-documents";

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

interface ClassificationResult {
  suggestedCategory: string;
  confidence: number;
  reasoning: string;
}

interface COIResult {
  carrier?: string;
  policyNumber?: string;
  coverageType?: string;
  effectiveDate?: string;
  expiryDate?: string;
  coverageAmount?: number;
  insuredName?: string;
  insuredCompany?: string;
  confidence: number;
}

interface ConflictResult {
  conflicts: Array<{
    field: string;
    documentValue: string;
    projectValue: string;
    severity: string;
    description: string;
  }>;
  checked: string[];
  summary: string;
}

interface DocumentAIPanelProps {
  documentId: string;
  documentName?: string;
  mimeType?: string;
  initialData?: ExtractedData | null;
}

export function DocumentAIPanel({ documentId, documentName, mimeType, initialData }: DocumentAIPanelProps) {
  const [data, setData] = useState<ExtractedData | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!!initialData);

  // Sprint 22 AI action states
  const [classifyResult, setClassifyResult] = useState<ClassificationResult | null>(null);
  const [coiResult, setCoiResult] = useState<COIResult | null>(null);
  const [conflictResult, setConflictResult] = useState<ConflictResult | null>(null);
  const [aiAction, setAiAction] = useState<string | null>(null); // tracks which action is loading

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

  const runClassify = async () => {
    if (!documentName) return;
    setAiAction("classify");
    setError(null);
    try {
      const result: any = await classifyDocument(documentName, mimeType || "application/octet-stream");
      if (result.success && result.result) {
        setClassifyResult(result.result as ClassificationResult);
        setExpanded(true);
      } else {
        setError(result.error || "Classification failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Classification failed");
    } finally {
      setAiAction(null);
    }
  };

  const runCOIExtract = async () => {
    setAiAction("coi");
    setError(null);
    try {
      const result: any = await extractCOIFields(documentId);
      if (result.success && result.fields) {
        setCoiResult(result.fields as COIResult);
        setExpanded(true);
      } else {
        setError(result.error || "COI extraction failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "COI extraction failed");
    } finally {
      setAiAction(null);
    }
  };

  const runConflictDetection = async () => {
    setAiAction("conflict");
    setError(null);
    try {
      const result: any = await detectDocumentConflicts(documentId);
      if (result.success && result.result) {
        setConflictResult(result.result as ConflictResult);
        setExpanded(true);
      } else {
        setError(result.error || "Conflict detection failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conflict detection failed");
    } finally {
      setAiAction(null);
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
        onClick={() => (data || classifyResult || coiResult || conflictResult) && setExpanded((v) => !v)}
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
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              runExtraction();
            }}
            disabled={loading || !!aiAction}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded transition-colors disabled:opacity-60"
            title="Extract text, dates, amounts, and keywords"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {data ? "Re-run" : "Extract"}
          </button>
          {documentName && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                runClassify();
              }}
              disabled={loading || !!aiAction}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors disabled:opacity-60"
              title="AI auto-classify document category"
            >
              {aiAction === "classify" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <FolderSearch className="w-3 h-3" />
              )}
              Classify
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              runCOIExtract();
            }}
            disabled={loading || !!aiAction}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded transition-colors disabled:opacity-60"
            title="Extract insurance certificate fields"
          >
            {aiAction === "coi" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ShieldCheck className="w-3 h-3" />
            )}
            COI
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              runConflictDetection();
            }}
            disabled={loading || !!aiAction}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded transition-colors disabled:opacity-60"
            title="Cross-reference document against project records"
          >
            {aiAction === "conflict" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <FileWarning className="w-3 h-3" />
            )}
            Conflicts
          </button>
          {(data || classifyResult || coiResult || conflictResult) &&
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
      {expanded && (data || classifyResult || coiResult || conflictResult) && (
        <div className="px-3 py-3 space-y-3 text-xs">
          {/* Summary */}
          {data && (
            <div className="flex items-start gap-1.5 text-gray-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
              <span>{data.summary}</span>
            </div>
          )}

          {/* Dates */}
          {data && data.detectedDates.length > 0 && (
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
          {data && data.detectedAmounts.length > 0 && (
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
          {data && data.refNumbers.length > 0 && (
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
          {data && data.detectedKeywords.length > 0 && (
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
          {data && data.hints.length > 0 && (
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
          {data && (
            <p className="text-[10px] text-gray-400 border-t border-gray-100 pt-2">
              Extracted {new Date(data.extractedAt).toLocaleString()} · {data.method}
              {data.note && ` · ${data.note}`}
            </p>
          )}

          {/* Classification result (#72) */}
          {classifyResult && (
            <div className="border-t border-gray-100 pt-2">
              <div className="flex items-center gap-1 text-gray-500 mb-1">
                <FolderSearch className="w-3 h-3 text-blue-500" />
                <span className="font-medium uppercase tracking-wide text-[10px]">Classification</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                  {classifyResult.suggestedCategory}
                </span>
                <span className={`text-xs ${classifyResult.confidence >= 70 ? "text-green-600" : classifyResult.confidence >= 50 ? "text-amber-600" : "text-red-500"}`}>
                  {Math.round(classifyResult.confidence * 100)}% confidence
                </span>
              </div>
              <p className="text-gray-600">{classifyResult.reasoning}</p>
            </div>
          )}

          {/* COI extraction result (#73) */}
          {coiResult && (
            <div className="border-t border-gray-100 pt-2">
              <div className="flex items-center gap-1 text-gray-500 mb-1">
                <ShieldCheck className="w-3 h-3 text-green-500" />
                <span className="font-medium uppercase tracking-wide text-[10px]">Insurance Certificate</span>
                <span className={`text-xs ml-1 ${coiResult.confidence >= 70 ? "text-green-600" : coiResult.confidence >= 50 ? "text-amber-600" : "text-red-500"}`}>
                  {Math.round(coiResult.confidence * 100)}% confidence
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {coiResult.carrier && (
                  <div><span className="text-gray-400">Carrier:</span> <span className="text-gray-700">{coiResult.carrier}</span></div>
                )}
                {coiResult.policyNumber && (
                  <div><span className="text-gray-400">Policy #:</span> <span className="font-mono text-gray-700">{coiResult.policyNumber}</span></div>
                )}
                {coiResult.coverageType && (
                  <div><span className="text-gray-400">Type:</span> <span className="text-gray-700">{coiResult.coverageType}</span></div>
                )}
                {coiResult.coverageAmount != null && (
                  <div><span className="text-gray-400">Amount:</span> <span className="text-gray-700">${coiResult.coverageAmount.toLocaleString()}</span></div>
                )}
                {coiResult.effectiveDate && (
                  <div><span className="text-gray-400">Effective:</span> <span className="text-gray-700">{coiResult.effectiveDate}</span></div>
                )}
                {coiResult.expiryDate && (
                  <div><span className="text-gray-400">Expiry:</span> <span className="text-gray-700">{coiResult.expiryDate}</span></div>
                )}
                {coiResult.insuredName && (
                  <div><span className="text-gray-400">Insured:</span> <span className="text-gray-700">{coiResult.insuredName}</span></div>
                )}
                {coiResult.insuredCompany && (
                  <div><span className="text-gray-400">Company:</span> <span className="text-gray-700">{coiResult.insuredCompany}</span></div>
                )}
              </div>
            </div>
          )}

          {/* Conflict detection result (#74) */}
          {conflictResult && (
            <div className="border-t border-gray-100 pt-2">
              <div className="flex items-center gap-1 text-gray-500 mb-1">
                <FileWarning className="w-3 h-3 text-amber-500" />
                <span className="font-medium uppercase tracking-wide text-[10px]">Conflict Detection</span>
              </div>
              <p className="text-gray-600 mb-1">{conflictResult.summary}</p>
              {conflictResult.conflicts.length > 0 ? (
                <div className="space-y-1.5">
                  {conflictResult.conflicts.map((c, i) => (
                    <div key={i} className={`px-2 py-1.5 rounded ${
                      c.severity === "HIGH" ? "bg-red-50 border border-red-100" :
                      c.severity === "MEDIUM" ? "bg-amber-50 border border-amber-100" :
                      "bg-yellow-50 border border-yellow-100"
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold uppercase ${
                          c.severity === "HIGH" ? "text-red-600" :
                          c.severity === "MEDIUM" ? "text-amber-600" :
                          "text-yellow-600"
                        }`}>{c.severity}</span>
                        <span className="font-medium text-gray-700">{c.field}</span>
                      </div>
                      <p className="text-gray-600 mt-0.5">{c.description}</p>
                      <div className="flex gap-3 mt-0.5 text-[10px]">
                        <span><span className="text-gray-400">Doc:</span> {c.documentValue}</span>
                        <span><span className="text-gray-400">Project:</span> {c.projectValue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>No conflicts detected</span>
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-1">
                Checked: {conflictResult.checked.join(", ")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
