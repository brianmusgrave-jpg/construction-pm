"use client";

/**
 * @file components/dashboard/BulkImportButton.tsx
 * @description CSV bulk-import button for creating multiple projects at once.
 *
 * Triggers a modal with:
 *   - A "Download CSV Template" button that builds a Blob from the embedded
 *     `CSV_TEMPLATE` constant and triggers a browser download as
 *     `projects-import-template.csv`.
 *   - A drag-and-drop / click-to-upload area (accepts .csv and .txt) that
 *     POSTs the selected file as FormData to `POST /api/import`.
 *   - On success: shows `ImportResult` (created/total/errors) in a green/amber
 *     card; if any projects were created, auto-reloads the page after 1.5 s.
 *   - On API error: shows the error message in a red banner.
 *   - Maximum 100 projects per file (enforced by the API route).
 *
 * CSV columns: name, description, status, location, start_date, end_date,
 *   budget, phases (semicolon-separated).
 *
 * No i18n — copy is hardcoded in English.
 */

import { useState, useRef } from "react";
import {
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Download,
} from "lucide-react";

const CSV_TEMPLATE = `name,description,status,location,start_date,end_date,budget,phases
"Riverside Apartments","8-unit residential complex","IN_PROGRESS","123 Main St, Springfield","2025-01-15","2025-09-30","850000","Foundation;Framing;Mechanical;Finishes"
"Office Renovation","Open-plan office remodel","PLANNING","456 Commerce Ave","2025-03-01","2025-06-30","120000","Demo;Framing;Electrical;Painting"
`;

interface ImportResult {
  created: number;
  errors: string[];
  total: number;
}

export function BulkImportButton() {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Import failed");
      } else {
        setResult(json as ImportResult);
        if (json.created > 0) {
          // Refresh the page to show new projects
          setTimeout(() => window.location.reload(), 1500);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "projects-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Upload className="w-4 h-4" />
        Import CSV
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[var(--color-primary)]" />
                Bulk Import Projects
              </h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Upload a CSV file to create multiple projects at once. Each row becomes one project.
              Separate phase names with semicolons (;).
            </p>

            <button
              onClick={downloadTemplate}
              className="w-full mb-4 flex items-center justify-center gap-2 py-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-100"
            >
              <Download className="w-4 h-4" />
              Download CSV Template
            </button>

            {error && (
              <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-sm rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            {result && (
              <div className={`mb-3 p-3 rounded-lg border text-sm ${result.created > 0 ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                <p className={`font-medium ${result.created > 0 ? "text-green-800" : "text-amber-800"}`}>
                  {result.created > 0
                    ? `✓ Created ${result.created} of ${result.total} projects`
                    : `No projects created`}
                </p>
                {result.errors.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {result.errors.map((e, i) => (
                      <li key={i} className="text-xs text-amber-700">{e}</li>
                    ))}
                  </ul>
                )}
                {result.created > 0 && (
                  <p className="text-xs text-green-600 mt-1">Refreshing page…</p>
                )}
              </div>
            )}

            <label className={`block w-full cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
              <div className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-[var(--color-primary)] hover:bg-gray-50 transition-colors">
                {uploading ? (
                  <>
                    <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
                    <p className="text-sm text-gray-600">Importing…</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">Click to upload CSV</p>
                      <p className="text-xs text-gray-400 mt-0.5">Max 100 projects per file</p>
                    </div>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFile}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      )}
    </>
  );
}
