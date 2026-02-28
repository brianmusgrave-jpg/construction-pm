"use client";

/**
 * @file components/phase/InspectionSection.tsx
 * @description Scheduled inspection tracker for a phase detail page.
 *
 * Displays upcoming and past inspections grouped by completion state.
 * Key behaviours:
 *   - Result states: PASS, FAIL, CONDITIONAL — each with a distinct icon/colour
 *     via `RESULT_CONFIG`.
 *   - Upcoming: `completedAt` is null AND `scheduledAt` >= now.
 *     Past: has `completedAt` OR `scheduledAt` < now.
 *   - `notifyOnResult` checkbox on the create form triggers a notification
 *     when a result is later recorded via `recordInspectionResult`.
 *   - Inline "Record Result" panel expands below the inspection row;
 *     includes an optional notes textarea before submitting the result.
 *
 * Permissions:
 *   - `canCreate` — may schedule new inspections.
 *   - `canRecord` — may record a PASS / FAIL / CONDITIONAL result.
 *
 * Server actions: `createInspection`, `recordInspectionResult`, `deleteInspection`.
 */

import { useState } from "react";
import {
  ClipboardCheck,
  Plus,
  Loader2,
  AlertCircle,
  X,
  Check,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Calendar,
  Trash2,
} from "lucide-react";
import {
  createInspection,
  recordInspectionResult,
  deleteInspection,
} from "@/actions/inspections";
import type { Inspection } from "@/lib/db-types";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

interface InspectionSectionProps {
  phaseId: string;
  inspections: Inspection[];
  canCreate: boolean;
  canRecord: boolean;
}

const RESULT_CONFIG = {
  PASS: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", label: "Pass" },
  FAIL: { icon: XCircle, color: "text-red-500", bg: "bg-red-50", label: "Fail" },
  CONDITIONAL: { icon: MinusCircle, color: "text-amber-600", bg: "bg-amber-50", label: "Conditional" },
};

function formatDt(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function InspectionSection({ phaseId, inspections, canCreate, canRecord }: InspectionSectionProps) {
  const confirm = useConfirmDialog();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [resultNotes, setResultNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", inspectorName: "", scheduledAt: "", notifyOnResult: true });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.scheduledAt) return;
    setSubmitting(true);
    setError(null);
    try {
      await createInspection({
        phaseId,
        title: form.title.trim(),
        inspectorName: form.inspectorName || undefined,
        scheduledAt: form.scheduledAt,
        notifyOnResult: form.notifyOnResult,
      });
      setForm({ title: "", inspectorName: "", scheduledAt: "", notifyOnResult: true });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule inspection");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecord = async (inspectionId: string, result: "PASS" | "FAIL" | "CONDITIONAL") => {
    setActionId(inspectionId);
    try {
      await recordInspectionResult(inspectionId, result, resultNotes || undefined);
      setRecordingId(null);
      setResultNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record result");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm("Delete this inspection?", { danger: true })) return;
    setActionId(id);
    try { await deleteInspection(id); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to delete"); }
    finally { setActionId(null); }
  };

  const upcoming = inspections.filter((i) => !i.completedAt && new Date(i.scheduledAt) >= new Date());
  const past = inspections.filter((i) => i.completedAt || new Date(i.scheduledAt) < new Date());

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[var(--color-primary)]" />
          Inspections
          {upcoming.length > 0 && (
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full normal-case">
              {upcoming.length} upcoming
            </span>
          )}
        </h2>
        {canCreate && (
          <button onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Schedule</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" /><span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
              <input required value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Framing Inspection"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Scheduled Date *</label>
              <input required type="date" value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Inspector Name</label>
              <input value={form.inspectorName}
                onChange={(e) => setForm((f) => ({ ...f, inspectorName: e.target.value }))}
                placeholder="Inspector or agency"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={form.notifyOnResult}
              onChange={(e) => setForm((f) => ({ ...f, notifyOnResult: e.target.checked }))}
              className="rounded border-gray-300 text-[var(--color-primary)]" />
            Notify team when result is recorded
          </label>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-1.5 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-md disabled:opacity-60 inline-flex items-center gap-1.5">
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Schedule
            </button>
          </div>
        </form>
      )}

      {inspections.length === 0 && !showForm ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <ClipboardCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No inspections scheduled</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...upcoming, ...past].map((insp) => {
            const cfg = insp.result ? RESULT_CONFIG[insp.result] : null;
            const ResultIcon = cfg?.icon;
            const isPending = !insp.completedAt && new Date(insp.scheduledAt) <= new Date();

            return (
              <div key={insp.id} className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{insp.title}</span>
                      {cfg && ResultIcon ? (
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                          <ResultIcon className="w-3 h-3" />{cfg.label}
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                          <AlertTriangle className="w-3 h-3" />Awaiting result
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                          <Clock className="w-3 h-3" />Upcoming
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDt(insp.scheduledAt)}</span>
                      {insp.inspectorName && <span>{insp.inspectorName}</span>}
                      {insp.notes && <span className="truncate max-w-[200px]">{insp.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canRecord && !insp.result && (
                      <button
                        onClick={() => setRecordingId(recordingId === insp.id ? null : insp.id)}
                        className="text-xs px-2 py-1 text-[var(--color-primary)] hover:bg-[var(--color-primary-bg)] rounded"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(insp.id)} disabled={actionId === insp.id}
                      className="p-1 text-gray-300 hover:text-red-500">
                      {actionId === insp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Record result panel */}
                {recordingId === insp.id && canRecord && (
                  <div className="border-t border-gray-100 p-3 bg-gray-50">
                    <p className="text-xs font-medium text-gray-700 mb-2">Record Result</p>
                    <input value={resultNotes}
                      onChange={(e) => setResultNotes(e.target.value)}
                      placeholder="Notes (optional)"
                      className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 mb-2 focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
                    <div className="flex gap-2">
                      <button onClick={() => handleRecord(insp.id, "PASS")} disabled={actionId === insp.id}
                        className="flex-1 py-1.5 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded">
                        ✓ Pass
                      </button>
                      <button onClick={() => handleRecord(insp.id, "CONDITIONAL")} disabled={actionId === insp.id}
                        className="flex-1 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded">
                        ~ Conditional
                      </button>
                      <button onClick={() => handleRecord(insp.id, "FAIL")} disabled={actionId === insp.id}
                        className="flex-1 py-1.5 text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded">
                        ✗ Fail
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
