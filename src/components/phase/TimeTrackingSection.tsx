"use client";

/**
 * @file components/phase/TimeTrackingSection.tsx
 * @description Labour time entry tracker for a phase detail page.
 *
 * Each entry records hours for a worker on a specific date at a phase.
 * Hours input uses `step="0.25"` (quarter-hour precision).
 *
 * Status workflow (via `STATUS_STYLES`):
 *   PENDING → APPROVED | REJECTED.
 *   Only PENDING entries can be deleted (by `canEdit`).
 *   Only managers can approve or reject.
 *
 * Summary bar shows:
 *   - totalHours: sum of all entries regardless of status.
 *   - approvedHours: sum of APPROVED entries only.
 *   - pendingCount: count of PENDING entries.
 *
 * Key behaviours:
 *   - Optional `costCode` field for budget tracking.
 *   - Date field defaults to today (`new Date().toISOString().slice(0, 10)`).
 *   - Collapsible section with `expanded` state.
 *   - Filter tabs: ALL / PENDING / APPROVED / REJECTED.
 *   - `allStaff` prop populates the worker dropdown.
 *
 * Permissions:
 *   - `canEdit`   — may create entries and delete PENDING entries.
 *   - `canManage` — may approve and reject PENDING entries.
 *
 * Server actions: `createTimeEntry`, `approveTimeEntry`,
 *   `rejectTimeEntry`, `deleteTimeEntry`.
 * i18n namespace: `timeTracking`.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createTimeEntry, approveTimeEntry, rejectTimeEntry, deleteTimeEntry } from "@/actions/timeEntry";
import { toast } from "sonner";
import {
  Timer,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  PENDING: { color: "text-amber-700", bg: "bg-amber-100" },
  APPROVED: { color: "text-green-700", bg: "bg-green-100" },
  REJECTED: { color: "text-red-700", bg: "bg-red-100" },
};

interface TimeTrackingSectionProps {
  phaseId: string;
  entries: any[];
  allStaff: any[];
  canEdit: boolean;
  canManage: boolean;
}

export function TimeTrackingSection({ phaseId, entries, allStaff, canEdit, canManage }: TimeTrackingSectionProps) {
  const t = useTranslations("timeTracking");
  const [items, setItems] = useState(entries);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");

  // Form state
  const [workerId, setWorkerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("");
  const [costCode, setCostCode] = useState("");
  const [description, setDescription] = useState("");

  const filtered = filter === "ALL" ? items : items.filter((i) => i.status === filter);

  const totalHours = items.reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
  const approvedHours = items.filter((e: any) => e.status === "APPROVED").reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
  const pendingCount = items.filter((e: any) => e.status === "PENDING").length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!workerId || !hours) return;
    setLoading(true);
    try {
      const item = await createTimeEntry({
        phaseId,
        workerId,
        date,
        hours: parseFloat(hours),
        costCode: costCode || undefined,
        description: description || undefined,
      });
      setItems((prev) => [{ ...item, worker: allStaff.find((s) => s.id === workerId) || { name: "?" }, createdBy: { name: "You" } }, ...prev]);
      setWorkerId("");
      setHours("");
      setCostCode("");
      setDescription("");
      setShowForm(false);
      toast.success(t("created"));
    } catch {
      toast.error(t("errorCreate"));
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      await approveTimeEntry(id);
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "APPROVED" } : i));
      toast.success(t("approved"));
    } catch {
      toast.error(t("errorApprove"));
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectTimeEntry(id);
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "REJECTED" } : i));
      toast.success(t("rejected"));
    } catch {
      toast.error(t("errorReject"));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteTimeEntry(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success(t("deleted"));
    } catch {
      toast.error(t("errorDelete"));
    }
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
            <Timer className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold">{t("title")}</h2>
            <span className="text-sm text-gray-500">({items.length})</span>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
          {canEdit && (
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" /> {t("addEntry")}
            </button>
          )}
        </div>

        {/* Summary bar */}
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span>{t("totalHours")}: <strong className="text-gray-700">{totalHours.toFixed(1)}h</strong></span>
          <span>{t("approvedHours")}: <strong className="text-green-600">{approvedHours.toFixed(1)}h</strong></span>
          {pendingCount > 0 && <span className="text-amber-600">{pendingCount} {t("pendingApproval")}</span>}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" required>
              <option value="">{t("selectWorker")}</option>
              {allStaff.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.role ? ` (${s.role})` : ""}</option>)}
            </select>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" required />
            <input type="number" step="0.25" min="0.25" max="24" value={hours} onChange={(e) => setHours(e.target.value)} placeholder={t("hoursPlaceholder")} className="border rounded-lg px-3 py-2 text-sm" required />
            <input type="text" value={costCode} onChange={(e) => setCostCode(e.target.value)} placeholder={t("costCodePlaceholder")} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("descriptionPlaceholder")} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100">{t("cancel")}</button>
            <button type="submit" disabled={loading} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{t("create")}</button>
          </div>
        </form>
      )}

      {expanded && (
        <>
          {/* Filter */}
          <div className="flex gap-1 p-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {["ALL", "PENDING", "APPROVED", "REJECTED"].map((s) => (
              <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${filter === s ? "bg-indigo-100 text-indigo-700 font-medium" : "text-gray-500 hover:bg-gray-100"}`}>
                {t(`filter${s.charAt(0) + s.slice(1).toLowerCase()}`)}
              </button>
            ))}
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">{t("empty")}</p>
            ) : (
              filtered.map((entry) => {
                const style = STATUS_STYLES[entry.status] || STATUS_STYLES.PENDING;
                return (
                  <div key={entry.id} className="p-3 sm:p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{entry.worker?.name || "?"}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>{t(`status${entry.status.charAt(0) + entry.status.slice(1).toLowerCase()}`)}</span>
                        {entry.costCode && <span className="text-xs font-mono text-gray-400">{entry.costCode}</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                        <span>{new Date(entry.date).toLocaleDateString()}</span>
                        <span className="font-semibold text-gray-700">{entry.hours}h</span>
                        {entry.description && <span className="truncate">{entry.description}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {entry.status === "PENDING" && canManage && (
                        <>
                          <button onClick={() => handleApprove(entry.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" aria-label="Approve">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleReject(entry.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" aria-label="Reject">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {entry.status === "PENDING" && canEdit && (
                        <button onClick={() => handleDelete(entry.id)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </section>
  );
}
