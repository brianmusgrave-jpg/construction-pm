"use client";

/**
 * @file components/directory/ImportContactsModal.tsx
 * @description Multi-step import wizard for bulk-importing contacts from
 * spreadsheets (XLSX, CSV). Three steps:
 *
 *   1. Upload — drag-and-drop or file picker
 *   2. Map Columns — auto-detected mappings with manual override
 *   3. Preview & Import — table preview with validation, duplicate detection
 *
 * Uses the /api/import-contacts endpoint for parsing and the
 * bulkImportStaff server action for the actual insert.
 */

import { useState, useCallback, useRef } from "react";
import {
  X,
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
  SkipForward,
} from "lucide-react";
import { bulkImportStaff } from "@/actions/staff";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type StaffField = "name" | "company" | "role" | "contactType" | "email" | "phone" | "location" | "notes" | "";

interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  mappings: Record<string, StaffField>;
  fileName: string;
}

interface ImportResult {
  created: number;
  errors: { row: number; message: string }[];
  skipped: { row: number; reason: string }[];
  total: number;
}

const STAFF_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  company: "Company",
  role: "Role / Trade",
  contactType: "Type",
  email: "Email",
  phone: "Phone",
  location: "Location",
  notes: "Notes",
  "": "— Skip —",
};

export function ImportContactsModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("directory");
  const tc = useTranslations("common");

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mappings, setMappings] = useState<Record<string, StaffField>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1: File Upload ──

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv", "tsv"].includes(ext ?? "")) {
      setError(t("importUnsupportedFile"));
      return;
    }

    setParsing(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import-contacts", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("importParseFailed"));
        setParsing(false);
        return;
      }

      setParseResult(data as ParseResult);
      setMappings(data.mappings);
      setStep(2);
    } catch {
      setError(t("importParseFailed"));
    } finally {
      setParsing(false);
    }
  }, [t]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ── Step 2: Column Mapping ──

  const updateMapping = (header: string, field: StaffField) => {
    setMappings((prev) => ({ ...prev, [header]: field }));
  };

  // Fields already mapped (excluding current header's selection)
  const usedFields = (excludeHeader: string): Set<string> => {
    const used = new Set<string>();
    for (const [h, f] of Object.entries(mappings)) {
      if (h !== excludeHeader && f) used.add(f);
    }
    return used;
  };

  const hasNameMapping = Object.values(mappings).includes("name");

  // ── Step 3: Preview & Import ──

  const getMappedRows = (): Record<string, string>[] => {
    if (!parseResult) return [];
    return parseResult.rows.map((row) => {
      const mapped: Record<string, string> = {};
      for (const [header, field] of Object.entries(mappings)) {
        if (field) {
          mapped[field] = row[header] || "";
        }
      }
      return mapped;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);

    try {
      const mappedRows = getMappedRows();
      const result = await bulkImportStaff(mappedRows, {
        skipDuplicateEmails: skipDuplicates,
      });
      setImportResult(result);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("importFailed"));
    } finally {
      setImporting(false);
    }
  };

  // ── Render ──

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {t("importContacts")}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {step === 1 && t("importStep1Desc")}
              {step === 2 && t("importStep2Desc")}
              {step === 3 && t("importStep3Desc", { count: parseResult?.totalRows ?? 0 })}
              {step === 4 && t("importComplete")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 pt-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium",
                  step > s
                    ? "bg-green-500 text-white"
                    : step === s
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-gray-200 text-gray-500"
                )}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={cn(
                    "w-12 h-0.5",
                    step > s ? "bg-green-500" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 1 && (
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-12 text-center transition-colors",
                dragOver
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-bg)]"
                  : "border-gray-300 hover:border-gray-400"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {parsing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-[var(--color-primary)] animate-spin" />
                  <p className="text-sm text-gray-600">{t("importParsing")}</p>
                </div>
              ) : (
                <>
                  <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-base font-medium text-gray-700 mb-1">
                    {t("importDragDrop")}
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    {t("importFileTypes")}
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
                  >
                    <Upload className="w-4 h-4 inline mr-2" />
                    {t("importBrowseFiles")}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.tsv"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </>
              )}
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && parseResult && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                <FileSpreadsheet className="w-4 h-4 inline mr-1.5" />
                {parseResult.fileName} — {parseResult.totalRows} {t("importRowsFound")}
              </div>

              <div className="space-y-2">
                {parseResult.headers.map((header) => (
                  <div
                    key={header}
                    className="flex items-center gap-3 py-2 px-3 bg-white border border-gray-200 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-700 truncate block">
                        {header}
                      </span>
                      <span className="text-xs text-gray-400 truncate block">
                        {t("importSampleValue")}: {parseResult.rows[0]?.[header] || "—"}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
                    <select
                      value={mappings[header] || ""}
                      onChange={(e) =>
                        updateMapping(header, e.target.value as StaffField)
                      }
                      className={cn(
                        "w-40 text-sm border rounded-lg px-2 py-1.5 outline-none",
                        mappings[header]
                          ? "border-[var(--color-primary)] text-gray-900 bg-[var(--color-primary-bg)]"
                          : "border-gray-300 text-gray-500"
                      )}
                    >
                      {Object.entries(STAFF_FIELD_LABELS).map(([val, label]) => {
                        const taken = val && usedFields(header).has(val);
                        return (
                          <option key={val} value={val} disabled={!!taken}>
                            {label}{taken ? " ✓" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ))}
              </div>

              {!hasNameMapping && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {t("importNameRequired")}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && parseResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {t("importPreviewCount", { count: parseResult.totalRows })}
                </span>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  {t("importSkipDuplicates")}
                </label>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          #
                        </th>
                        {Object.entries(mappings)
                          .filter(([, f]) => f)
                          .map(([header, field]) => (
                            <th
                              key={`${header}-${field}`}
                              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                            >
                              {STAFF_FIELD_LABELS[field]}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {getMappedRows()
                        .slice(0, 20)
                        .map((row, i) => (
                          <tr
                            key={i}
                            className={cn(
                              !row.name?.trim() && "bg-red-50"
                            )}
                          >
                            <td className="px-3 py-1.5 text-gray-400">
                              {i + 1}
                            </td>
                            {Object.entries(mappings)
                              .filter(([, f]) => f)
                              .map(([, field]) => (
                                <td
                                  key={field}
                                  className="px-3 py-1.5 text-gray-700 max-w-[200px] truncate"
                                >
                                  {row[field] || "—"}
                                </td>
                              ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {parseResult.totalRows > 20 && (
                  <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 text-center border-t">
                    {t("importShowingPreview", {
                      shown: 20,
                      total: parseResult.totalRows,
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Results */}
          {step === 4 && importResult && (
            <div className="space-y-4">
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {t("importSuccessTitle", { count: importResult.created })}
                </h3>
                <p className="text-sm text-gray-500">
                  {t("importSuccessDesc", { total: importResult.total })}
                </p>
              </div>

              {importResult.skipped.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-medium text-amber-700 mb-1 flex items-center gap-1.5">
                    <SkipForward className="w-4 h-4" />
                    {t("importSkippedCount", { count: importResult.skipped.length })}
                  </p>
                  <ul className="text-xs text-amber-600 space-y-0.5">
                    {importResult.skipped.slice(0, 5).map((s, i) => (
                      <li key={i}>
                        Row {s.row}: {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-700 mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {t("importErrorCount", { count: importResult.errors.length })}
                  </p>
                  <ul className="text-xs text-red-600 space-y-0.5">
                    {importResult.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-200">
          <div>
            {step === 2 && (
              <button
                onClick={() => {
                  setStep(1);
                  setParseResult(null);
                  setError(null);
                }}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("importBackToUpload")}
              </button>
            )}
            {step === 3 && (
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("importBackToMapping")}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === 4 ? (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                {tc("done")}
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {tc("cancel")}
                </button>
                {step === 2 && (
                  <button
                    onClick={() => setStep(3)}
                    disabled={!hasNameMapping}
                    className="px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {t("importPreview")}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {step === 3 && (
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("importImporting")}
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        {t("importNow", { count: parseResult?.totalRows ?? 0 })}
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
