"use client";

/**
 * @file components/project/DailyLogSection.tsx
 * @description Site diary / field journal section for a project detail page.
 *
 * Each log entry captures the following fields:
 *   date (required), weather (select from 8 WEATHER_OPTIONS), tempHigh / tempLow (°F),
 *   crewCount, equipment (free text), workSummary (required textarea),
 *   issues / delays (textarea), notes (textarea).
 *
 * List behaviour:
 *   - Entries are rendered as collapsible rows; clicking toggles `expandedId`.
 *   - Collapsed row shows: formatted date, weather (sm+), crew count (sm+),
 *     truncated workSummary, and an AlertTriangle icon if `log.issues` is present.
 *   - Expanded panel shows all fields plus author name/email.
 *   - Delete button (Trash2) calls `deleteDailyLog(id)` after confirm(); tracked
 *     by `deletingId` to show spinner while in-flight.
 *
 * `canCreate` prop controls visibility of the "Add Entry" button and form.
 *
 * Server actions: `createDailyLog`, `deleteDailyLog`.
 */

import { useState } from "react";
import {
  BookOpen,
  Plus,
  Loader2,
  AlertCircle,
  X,
  Trash2,
  ThermometerSun,
  Users,
  Wrench,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { createDailyLog, deleteDailyLog } from "@/actions/daily-logs";
import type { DailyLog } from "@/lib/db-types";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

interface DailyLogSectionProps {
  projectId: string;
  logs: DailyLog[];
  canCreate: boolean;
}

const WEATHER_OPTIONS = ["Sunny", "Partly Cloudy", "Cloudy", "Rainy", "Stormy", "Windy", "Foggy", "Snowy"];

export function DailyLogSection({ projectId, logs, canCreate }: DailyLogSectionProps) {
  const confirm = useConfirmDialog();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date: today,
    weather: "",
    tempHigh: "",
    tempLow: "",
    crewCount: "",
    equipment: "",
    workSummary: "",
    issues: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.workSummary.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createDailyLog({
        projectId,
        date: form.date,
        weather: form.weather || undefined,
        tempHigh: form.tempHigh ? Number(form.tempHigh) : undefined,
        tempLow: form.tempLow ? Number(form.tempLow) : undefined,
        crewCount: form.crewCount ? Number(form.crewCount) : undefined,
        equipment: form.equipment || undefined,
        workSummary: form.workSummary,
        issues: form.issues || undefined,
        notes: form.notes || undefined,
      });
      setForm({ date: today, weather: "", tempHigh: "", tempLow: "", crewCount: "", equipment: "", workSummary: "", issues: "", notes: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save log");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm("Delete this daily log entry?", { danger: true })) return;
    setDeletingId(id);
    try {
      await deleteDailyLog(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--color-primary)]" />
          Site Diary
          <span className="text-xs font-normal text-gray-400 normal-case">
            ({logs.length} entries)
          </span>
        </h2>
        {canCreate && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Entry</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" required value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Weather</label>
              <select value={form.weather} onChange={(e) => setForm((f) => ({ ...f, weather: e.target.value }))}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]">
                <option value="">—</option>
                {WEATHER_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Crew Count</label>
              <input type="number" min="0" value={form.crewCount}
                onChange={(e) => setForm((f) => ({ ...f, crewCount: e.target.value }))}
                placeholder="0"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">High Temp (°F)</label>
              <input type="number" value={form.tempHigh}
                onChange={(e) => setForm((f) => ({ ...f, tempHigh: e.target.value }))}
                placeholder="e.g. 78"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Low Temp (°F)</label>
              <input type="number" value={form.tempLow}
                onChange={(e) => setForm((f) => ({ ...f, tempLow: e.target.value }))}
                placeholder="e.g. 55"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Equipment Used</label>
            <input value={form.equipment}
              onChange={(e) => setForm((f) => ({ ...f, equipment: e.target.value }))}
              placeholder="e.g. Excavator, Crane, Forklift"
              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Work Summary *</label>
            <textarea required value={form.workSummary}
              onChange={(e) => setForm((f) => ({ ...f, workSummary: e.target.value }))}
              placeholder="Describe the work performed today..."
              rows={3}
              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Issues / Delays</label>
            <textarea value={form.issues}
              onChange={(e) => setForm((f) => ({ ...f, issues: e.target.value }))}
              placeholder="Any problems encountered..."
              rows={2}
              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Additional notes..."
              rows={2}
              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-1.5 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-md disabled:opacity-60 inline-flex items-center gap-1.5">
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Entry
            </button>
          </div>
        </form>
      )}

      {/* Log list */}
      {logs.length === 0 && !showForm ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No site diary entries yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id}
              className="border border-gray-100 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                    {new Date(log.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  {log.weather && (
                    <span className="text-xs text-gray-500 hidden sm:inline">{log.weather}</span>
                  )}
                  {log.crewCount != null && (
                    <span className="text-xs text-gray-500 flex items-center gap-1 hidden sm:flex">
                      <Users className="w-3 h-3" />{log.crewCount}
                    </span>
                  )}
                  <span className="text-xs text-gray-600 truncate flex-1 min-w-0">{log.workSummary}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {log.issues && (
                    <span title="Has issues"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /></span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(log.id); }}
                    disabled={deletingId === log.id}
                    className="p-1 text-gray-300 hover:text-red-500"
                  >
                    {deletingId === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </button>

              {expandedId === log.id && (
                <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-2 text-sm">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {log.weather && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <ThermometerSun className="w-3.5 h-3.5 text-amber-500" />
                        {log.weather}
                        {log.tempHigh != null && ` ${log.tempHigh}°`}
                        {log.tempLow != null && `/${log.tempLow}°`}
                      </div>
                    )}
                    {log.crewCount != null && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        {log.crewCount} crew
                      </div>
                    )}
                    {log.equipment && (
                      <div className="flex items-center gap-1 text-gray-600 col-span-2">
                        <Wrench className="w-3.5 h-3.5 text-gray-400" />
                        {log.equipment}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-0.5 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Work Summary
                    </p>
                    <p className="text-sm text-gray-800">{log.workSummary}</p>
                  </div>
                  {log.issues && (
                    <div>
                      <p className="text-xs font-medium text-amber-600 mb-0.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Issues
                      </p>
                      <p className="text-sm text-gray-800">{log.issues}</p>
                    </div>
                  )}
                  {log.notes && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-0.5">Notes</p>
                      <p className="text-sm text-gray-800">{log.notes}</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">
                    By {log.author?.name || log.author?.email || "—"}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
