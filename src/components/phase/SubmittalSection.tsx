"use client";

/**
 * @file components/phase/SubmittalSection.tsx
 * @description Construction submittal log for a phase detail page.
 *
 * Each submittal is numbered sequentially (submittalNumber) and displayed
 *   as "SUB-NNN" with zero-padded 3 digits.
 *
 * Status workflow (via `STATUS_CONFIG`):
 *   PENDING → UNDER_REVIEW → APPROVED | APPROVED_AS_NOTED
 *                           → REVISE_AND_RESUBMIT | REJECTED.
 *   `reviseSubmittal` increments the `revision` counter and resets
 *   status to PENDING for resubmission.
 *
 * Filter buckets:
 *   ALL / PENDING / UNDER_REVIEW / APPROVED (includes APPROVED_AS_NOTED) /
 *   ACTION (REVISE_AND_RESUBMIT + REJECTED).
 *
 * Key behaviours:
 *   - `specSection` field ties the submittal to a spec section reference.
 *   - Overdue detection: `dueDate < now && status not in [APPROVED, APPROVED_AS_NOTED]`.
 *   - Expandable rows show description, metadata, review actions, and
 *     resubmit button for ACTION-bucket items.
 *   - `returnedAt` timestamp recorded on status changes.
 *
 * Permissions:
 *   - `canEdit`   — may create and resubmit submittals.
 *   - `canManage` — may advance review status and delete.
 *
 * Server actions: `createSubmittal`, `updateSubmittalStatus`,
 *   `reviseSubmittal`, `deleteSubmittal`.
 * i18n namespace: `submittal`.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createSubmittal, updateSubmittalStatus, reviseSubmittal, deleteSubmittal } from "@/actions/submittal";
import { toast } from "sonner";
import {
  FileCheck2,
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  FileText,
  Eye,
} from "lucide-react";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  PENDING: { icon: Clock, color: "text-blue-500", label: "Pending" },
  UNDER_REVIEW: { icon: Eye, color: "text-amber-500", label: "Under Review" },
  APPROVED: { icon: CheckCircle2, color: "text-green-500", label: "Approved" },
  APPROVED_AS_NOTED: { icon: CheckCircle2, color: "text-green-400", label: "Approved as Noted" },
  REVISE_AND_RESUBMIT: { icon: RefreshCw, color: "text-orange-500", label: "Revise & Resubmit" },
  REJECTED: { icon: XCircle, color: "text-red-500", label: "Rejected" },
};

interface SubmittalSectionProps {
  phaseId: string;
  submittals: any[];
  allStaff: any[];
  canEdit: boolean;
  canManage: boolean;
}

export function SubmittalSection({ phaseId, submittals, allStaff, canEdit, canManage }: SubmittalSectionProps) {
  const confirm = useConfirmDialog();
  const t = useTranslations("submittal");
  const [items, setItems] = useState(submittals);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [specSection, setSpecSection] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const filtered = filter === "ALL" ? items : items.filter((i) => i.status === filter);

  const counts = {
    ALL: items.length,
    PENDING: items.filter((i) => i.status === "PENDING").length,
    UNDER_REVIEW: items.filter((i) => i.status === "UNDER_REVIEW").length,
    APPROVED: items.filter((i) => ["APPROVED", "APPROVED_AS_NOTED"].includes(i.status)).length,
    ACTION: items.filter((i) => ["REVISE_AND_RESUBMIT", "REJECTED"].includes(i.status)).length,
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const item = await createSubmittal({
        phaseId,
        title: title.trim(),
        specSection: specSection || undefined,
        description: description || undefined,
        assignedToId: assignedToId || undefined,
        dueDate: dueDate || undefined,
      });
      setItems((prev) => [...prev, { ...item, submittedBy: { name: "You" }, assignedTo: allStaff.find((s) => s.id === assignedToId) || null }]);
      setTitle("");
      setSpecSection("");
      setDescription("");
      setAssignedToId("");
      setDueDate("");
      setShowForm(false);
      toast.success(t("created"));
    } catch {
      toast.error(t("errorCreate"));
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await updateSubmittalStatus(id, status);
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status, returnedAt: new Date().toISOString() } : i));
      toast.success(t("statusUpdated"));
    } catch {
      toast.error(t("errorStatus"));
    }
  }

  async function handleRevise(id: string) {
    try {
      const updated = await reviseSubmittal(id);
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, revision: updated.revision || (i.revision + 1), status: "PENDING", returnedAt: null } : i));
      toast.success(t("revised"));
    } catch {
      toast.error(t("errorRevise"));
    }
  }

  async function handleDelete(id: string) {
    if (!await confirm(t("confirmDelete"), { danger: true })) return;
    try {
      await deleteSubmittal(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success(t("deleted"));
    } catch {
      toast.error(t("errorDelete"));
    }
  }

  const isOverdue = (item: any) => item.dueDate && !["APPROVED", "APPROVED_AS_NOTED"].includes(item.status) && new Date(item.dueDate) < new Date();

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <span className="text-sm text-gray-500">({items.length})</span>
        </div>
        {canEdit && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-sm bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors">
            <Plus className="w-4 h-4" /> {t("addSubmittal")}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-3">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} className="w-full border rounded-lg px-3 py-2 text-sm" required />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <input type="text" value={specSection} onChange={(e) => setSpecSection(e.target.value)} placeholder={t("specSectionPlaceholder")} className="border rounded-lg px-3 py-2 text-sm" />
            <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">{t("unassigned")}</option>
              {allStaff.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("descriptionPlaceholder")} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100">{t("cancel")}</button>
            <button type="submit" disabled={loading} className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">{t("create")}</button>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 p-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {[
          { key: "ALL", label: t("filterAll") },
          { key: "PENDING", label: t("filterPending") },
          { key: "UNDER_REVIEW", label: t("filterUnderReview") },
          { key: "APPROVED", label: t("filterApproved") },
          { key: "ACTION", label: t("filterAction") },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${filter === key ? "bg-purple-100 text-purple-700 font-medium" : "text-gray-500 hover:bg-gray-100"}`}>
            {label} ({counts[key as keyof typeof counts]})
          </button>
        ))}
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">{t("empty")}</p>
        ) : (
          filtered.map((sub) => {
            const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = cfg.icon;
            const expanded = expandedId === sub.id;
            const overdue = isOverdue(sub);

            return (
              <div key={sub.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750">
                <div className="flex items-start gap-3 cursor-pointer" onClick={() => setExpandedId(expanded ? null : sub.id)}>
                  <StatusIcon className={`w-5 h-5 mt-0.5 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-400">SUB-{String(sub.submittalNumber).padStart(3, "0")}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.color} bg-opacity-10`}>{t(`status${sub.status.replace(/_/g, "")}`)}</span>
                      {sub.revision > 0 && <span className="text-xs text-gray-400">Rev {sub.revision}</span>}
                      {overdue && <span className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{t("overdue")}</span>}
                    </div>
                    <p className="text-sm font-medium mt-1">{sub.title}</p>
                    {sub.specSection && <p className="text-xs text-gray-500"><FileText className="w-3 h-3 inline mr-1" />{sub.specSection}</p>}
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>

                {expanded && (
                  <div className="mt-3 ml-8 space-y-3">
                    {sub.description && (
                      <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{sub.description}</p>
                      </div>
                    )}
                    <div className="text-xs text-gray-400 flex gap-4 flex-wrap">
                      {sub.assignedTo && <span>{t("assignedTo")}: {sub.assignedTo.name}</span>}
                      {sub.dueDate && <span>{t("dueDate")}: {new Date(sub.dueDate).toLocaleDateString()}</span>}
                      <span>{t("submittedBy")}: {sub.submittedBy?.name}</span>
                      {sub.returnedAt && <span>{t("returnedAt")}: {new Date(sub.returnedAt).toLocaleDateString()}</span>}
                    </div>

                    {/* Review actions (managers) */}
                    {canManage && (
                      <div className="flex gap-2 flex-wrap">
                        {sub.status === "PENDING" && (
                          <button onClick={() => handleStatusChange(sub.id, "UNDER_REVIEW")} className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">{t("startReview")}</button>
                        )}
                        {sub.status === "UNDER_REVIEW" && (
                          <>
                            <button onClick={() => handleStatusChange(sub.id, "APPROVED")} className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">{t("approve")}</button>
                            <button onClick={() => handleStatusChange(sub.id, "APPROVED_AS_NOTED")} className="text-xs px-3 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">{t("approveAsNoted")}</button>
                            <button onClick={() => handleStatusChange(sub.id, "REVISE_AND_RESUBMIT")} className="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200">{t("reviseResubmit")}</button>
                            <button onClick={() => handleStatusChange(sub.id, "REJECTED")} className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">{t("reject")}</button>
                          </>
                        )}
                        {["REVISE_AND_RESUBMIT", "REJECTED"].includes(sub.status) && canEdit && (
                          <button onClick={() => handleRevise(sub.id)} className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">{t("resubmit")}</button>
                        )}
                        <button onClick={() => handleDelete(sub.id)} className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
