"use client";

/**
 * @file components/phase/PunchListSection.tsx
 * @description Punch list (deficiency list) tracker for a phase detail page.
 *
 * Status flow defined in `STATUS_FLOW`:
 *   OPEN → IN_PROGRESS → READY_FOR_REVIEW → CLOSED.
 *   Closed items can be re-opened via a "Reopen" button.
 *
 * Priorities defined in `PRIORITY_CONFIG`:
 *   CRITICAL (red), MAJOR (orange), MINOR (yellow), COSMETIC (gray).
 *
 * Key behaviours:
 *   - Items are expandable rows (click to reveal description, location,
 *     assignee, due date, and status-change buttons).
 *   - Overdue flag: `item.dueDate < new Date() && item.status !== "CLOSED"`.
 *   - Status filter tabs include counts; filter includes all statuses plus ALL.
 *   - Summary badges show total open count and critical-open count.
 *   - `allStaff` prop populates the assignee dropdown on the create form.
 *
 * Permissions:
 *   - `canEdit`   — may create items and advance status (including reopen).
 *   - `canManage` — may delete items.
 *
 * Server actions: `createPunchListItem`, `updatePunchListStatus`,
 *   `deletePunchListItem`.
 * i18n namespace: `punchList`.
 */

import { useState } from "react";
import {
  ListChecks,
  Plus,
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
  Trash2,
  MapPin,
  User,
  Calendar,
  CircleDot,
  Circle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flag,
} from "lucide-react";
import {
  createPunchListItem,
  updatePunchListStatus,
  deletePunchListItem,
} from "@/actions/punchList";
import { useTranslations } from "next-intl";

interface PunchListItem {
  id: string;
  itemNumber: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  location: string | null;
  dueDate: string | null;
  closedAt: string | null;
  createdAt: string;
  assignedTo: { id: string; name: string; company: string | null } | null;
  createdBy: { id: string; name: string } | null;
}

interface PunchListSectionProps {
  phaseId: string;
  items: PunchListItem[];
  allStaff: { id: string; name: string; company: string | null }[];
  canEdit: boolean;
  canManage: boolean;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  OPEN: { icon: Circle, color: "text-red-500", bg: "bg-red-50", label: "Open" },
  IN_PROGRESS: { icon: CircleDot, color: "text-blue-600", bg: "bg-blue-50", label: "In Progress" },
  READY_FOR_REVIEW: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", label: "Ready for Review" },
  CLOSED: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", label: "Closed" },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  CRITICAL: { color: "text-red-700", bg: "bg-red-100", label: "Critical" },
  MAJOR: { color: "text-orange-700", bg: "bg-orange-100", label: "Major" },
  MINOR: { color: "text-yellow-700", bg: "bg-yellow-100", label: "Minor" },
  COSMETIC: { color: "text-gray-600", bg: "bg-gray-100", label: "Cosmetic" },
};

const STATUS_FLOW = ["OPEN", "IN_PROGRESS", "READY_FOR_REVIEW", "CLOSED"];

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function PunchListSection({ phaseId, items, allStaff, canEdit, canManage }: PunchListSectionProps) {
  const t = useTranslations("punchList");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MAJOR",
    location: "",
    assignedToId: "",
    dueDate: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPunchListItem({
        phaseId,
        title: form.title.trim(),
        description: form.description || undefined,
        priority: form.priority,
        location: form.location || undefined,
        assignedToId: form.assignedToId || undefined,
        dueDate: form.dueDate || undefined,
      });
      setForm({ title: "", description: "", priority: "MAJOR", location: "", assignedToId: "", dueDate: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorCreate"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    setActionId(itemId);
    try {
      await updatePunchListStatus(itemId, newStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorUpdate"));
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    setActionId(id);
    try {
      await deletePunchListItem(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorDelete"));
    } finally {
      setActionId(null);
    }
  };

  const filtered = filter === "ALL" ? items : items.filter((i) => i.status === filter);
  const openCount = items.filter((i) => i.status !== "CLOSED").length;
  const criticalCount = items.filter((i) => i.priority === "CRITICAL" && i.status !== "CLOSED").length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-[var(--color-primary)]" />
          {t("title")}
          {openCount > 0 && (
            <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full normal-case">
              {openCount} {t("open")}
            </span>
          )}
          {criticalCount > 0 && (
            <span className="text-xs font-medium text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full normal-case flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" />{criticalCount}
            </span>
          )}
        </h2>
        {canEdit && (
          <button onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("addItem")}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" /><span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Filter tabs */}
      {items.length > 0 && (
        <div className="flex gap-1 mb-3 overflow-x-auto">
          {["ALL", ...STATUS_FLOW].map((s) => {
            const count = s === "ALL" ? items.length : items.filter((i) => i.status === s).length;
            return (
              <button key={s} onClick={() => setFilter(s)}
                className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                  filter === s
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {s === "ALL" ? t("filterAll") : STATUS_CONFIG[s]?.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">{t("itemTitle")} *</label>
              <input required value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={t("titlePlaceholder")}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">{t("description")}</label>
              <textarea value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t("descriptionPlaceholder")}
                rows={2}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t("priority")} *</label>
              <select value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]">
                <option value="CRITICAL">{t("priorityCritical")}</option>
                <option value="MAJOR">{t("priorityMajor")}</option>
                <option value="MINOR">{t("priorityMinor")}</option>
                <option value="COSMETIC">{t("priorityCosmetic")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t("location")}</label>
              <input value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder={t("locationPlaceholder")}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t("assignTo")}</label>
              <select value={form.assignedToId}
                onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]">
                <option value="">{t("unassigned")}</option>
                {allStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.company ? ` (${s.company})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t("dueDate")}</label>
              <input type="date" value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md">{t("cancel")}</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-1.5 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-md disabled:opacity-60 inline-flex items-center gap-1.5">
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{t("create")}
            </button>
          </div>
        </form>
      )}

      {/* Items list */}
      {filtered.length === 0 && !showForm ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <ListChecks className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const stCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.OPEN;
            const prCfg = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.MAJOR;
            const StIcon = stCfg.icon;
            const isExpanded = expandedId === item.id;
            const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== "CLOSED";
            const currentIdx = STATUS_FLOW.indexOf(item.status);
            const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

            return (
              <div key={item.id} className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                  <span className="text-xs text-gray-400 font-mono shrink-0">#{item.itemNumber}</span>
                  <StIcon className={`w-4 h-4 shrink-0 ${stCfg.color}`} />
                  <span className="text-sm font-medium text-gray-900 min-w-0 flex-1 truncate">{item.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${prCfg.bg} ${prCfg.color}`}>{prCfg.label}</span>
                  {isOverdue && (
                    <span className="text-xs text-red-500 flex items-center gap-0.5 shrink-0">
                      <Flag className="w-3 h-3" />{t("overdue")}
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
                    {item.description && (
                      <p className="text-sm text-gray-600">{item.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      {item.location && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.location}</span>
                      )}
                      {item.assignedTo && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{item.assignedTo.name}</span>
                      )}
                      {item.dueDate && (
                        <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500 font-medium" : ""}`}>
                          <Calendar className="w-3 h-3" />{t("due")}: {formatDate(item.dueDate)}
                        </span>
                      )}
                      {item.closedAt && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-3 h-3" />{t("closedOn")}: {formatDate(item.closedAt)}
                        </span>
                      )}
                    </div>

                    {/* Status flow buttons */}
                    {canEdit && item.status !== "CLOSED" && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                        <span className="text-xs text-gray-500">{t("moveTo")}:</span>
                        {STATUS_FLOW.filter((s) => s !== item.status).map((s) => {
                          const cfg = STATUS_CONFIG[s];
                          return (
                            <button key={s} onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, s); }}
                              disabled={actionId === item.id}
                              className={`text-xs px-2 py-1 rounded ${cfg.bg} ${cfg.color} hover:opacity-80`}>
                              {cfg.label}
                            </button>
                          );
                        })}
                        {canManage && (
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                            disabled={actionId === item.id}
                            className="ml-auto p-1 text-gray-300 hover:text-red-500">
                            {actionId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Closed items — reopen option */}
                    {canEdit && item.status === "CLOSED" && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                        <button onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, "OPEN"); }}
                          disabled={actionId === item.id}
                          className="text-xs px-2 py-1 rounded bg-red-50 text-red-500 hover:opacity-80">
                          {t("reopen")}
                        </button>
                        {canManage && (
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                            disabled={actionId === item.id}
                            className="ml-auto p-1 text-gray-300 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
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
