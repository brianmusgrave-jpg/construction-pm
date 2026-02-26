"use client";

/**
 * @file components/phase/RFISection.tsx
 * @description Request for Information (RFI) tracker for a phase detail page.
 *
 * Each RFI is numbered sequentially (rfiNumber) and displayed as
 *   "RFI-NNN" with zero-padded 3 digits.
 *
 * Status workflow:
 *   OPEN → ANSWERED (via `answerRFI`) → CLOSED (via `canManage`).
 *   Any non-VOID RFI can be voided by `canManage` at any time.
 *
 * Priority levels (via `PRIORITY_CONFIG`):
 *   URGENT (red), HIGH (orange), NORMAL (blue), LOW (gray).
 *
 * Key behaviours:
 *   - `ballInCourt` text field identifies the responsible party.
 *   - Overdue detection: `item.dueDate && item.status === "OPEN" &&
 *     new Date(item.dueDate) < new Date()`.
 *   - Expandable rows show question, answer (if ANSWERED), metadata,
 *     and inline answer form (`answeringId` state).
 *   - Filter tabs: ALL / OPEN / ANSWERED / CLOSED (with counts).
 *
 * Permissions:
 *   - `canEdit`   — may create RFIs and provide answers.
 *   - `canManage` — may close, void, and delete RFIs.
 *
 * Server actions: `createRFI`, `answerRFI`, `updateRFIStatus`, `deleteRFI`.
 * i18n namespace: `rfi`.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createRFI, answerRFI, updateRFIStatus, deleteRFI } from "@/actions/rfi";
import { toast } from "sonner";
import {
  MessageSquareText,
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  MessageCircle,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { icon: any; color: string }> = {
  OPEN: { icon: Clock, color: "text-blue-500" },
  ANSWERED: { icon: MessageCircle, color: "text-amber-500" },
  CLOSED: { icon: CheckCircle2, color: "text-green-500" },
  VOID: { icon: XCircle, color: "text-gray-400" },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  URGENT: { color: "text-red-700", bg: "bg-red-100" },
  HIGH: { color: "text-orange-700", bg: "bg-orange-100" },
  NORMAL: { color: "text-blue-700", bg: "bg-blue-100" },
  LOW: { color: "text-gray-600", bg: "bg-gray-100" },
};

interface RFISectionProps {
  phaseId: string;
  rfis: any[];
  allStaff: any[];
  canEdit: boolean;
  canManage: boolean;
}

export function RFISection({ phaseId, rfis, allStaff, canEdit, canManage }: RFISectionProps) {
  const t = useTranslations("rfi");
  const [items, setItems] = useState(rfis);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [filter, setFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);

  // Form state
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [ballInCourt, setBallInCourt] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const filtered = filter === "ALL" ? items : items.filter((i) => i.status === filter);

  const counts = {
    ALL: items.length,
    OPEN: items.filter((i) => i.status === "OPEN").length,
    ANSWERED: items.filter((i) => i.status === "ANSWERED").length,
    CLOSED: items.filter((i) => i.status === "CLOSED").length,
  };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !question.trim()) return;
    setLoading(true);
    try {
      const item = await createRFI({
        phaseId,
        subject: subject.trim(),
        question: question.trim(),
        priority,
        ballInCourt: ballInCourt || undefined,
        assignedToId: assignedToId || undefined,
        dueDate: dueDate || undefined,
      });
      setItems((prev) => [...prev, { ...item, createdBy: { name: "You" }, assignedTo: allStaff.find((s) => s.id === assignedToId) || null }]);
      setSubject("");
      setQuestion("");
      setPriority("NORMAL");
      setBallInCourt("");
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

  async function handleAnswer(rfiId: string) {
    if (!answerText.trim()) return;
    setLoading(true);
    try {
      await answerRFI(rfiId, answerText.trim());
      setItems((prev) => prev.map((i) => i.id === rfiId ? { ...i, answer: answerText.trim(), status: "ANSWERED", answeredAt: new Date().toISOString() } : i));
      setAnsweringId(null);
      setAnswerText("");
      toast.success(t("answered"));
    } catch {
      toast.error(t("errorAnswer"));
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(rfiId: string, status: string) {
    try {
      await updateRFIStatus(rfiId, status);
      setItems((prev) => prev.map((i) => i.id === rfiId ? { ...i, status } : i));
      toast.success(t("statusUpdated"));
    } catch {
      toast.error(t("errorStatus"));
    }
  }

  async function handleDelete(rfiId: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteRFI(rfiId);
      setItems((prev) => prev.filter((i) => i.id !== rfiId));
      toast.success(t("deleted"));
    } catch {
      toast.error(t("errorDelete"));
    }
  }

  const isOverdue = (item: any) => item.dueDate && item.status === "OPEN" && new Date(item.dueDate) < new Date();

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareText className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <span className="text-sm text-gray-500">({items.length})</span>
        </div>
        {canEdit && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> {t("addRFI")}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-3">
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("subjectPlaceholder")} className="w-full border rounded-lg px-3 py-2 text-sm" required />
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("questionPlaceholder")} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" required />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="URGENT">{t("priorityUrgent")}</option>
              <option value="HIGH">{t("priorityHigh")}</option>
              <option value="NORMAL">{t("priorityNormal")}</option>
              <option value="LOW">{t("priorityLow")}</option>
            </select>
            <input type="text" value={ballInCourt} onChange={(e) => setBallInCourt(e.target.value)} placeholder={t("ballInCourt")} className="border rounded-lg px-3 py-2 text-sm" />
            <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">{t("unassigned")}</option>
              {allStaff.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100">{t("cancel")}</button>
            <button type="submit" disabled={loading} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{t("create")}</button>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 p-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {(["ALL", "OPEN", "ANSWERED", "CLOSED"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${filter === s ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-500 hover:bg-gray-100"}`}>
            {t(`filter${s.charAt(0) + s.slice(1).toLowerCase()}`)} ({counts[s]})
          </button>
        ))}
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">{t("empty")}</p>
        ) : (
          filtered.map((rfi) => {
            const StatusIcon = STATUS_CONFIG[rfi.status]?.icon || Clock;
            const statusColor = STATUS_CONFIG[rfi.status]?.color || "text-gray-500";
            const priorityCfg = PRIORITY_CONFIG[rfi.priority] || PRIORITY_CONFIG.NORMAL;
            const expanded = expandedId === rfi.id;
            const overdue = isOverdue(rfi);

            return (
              <div key={rfi.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750">
                <div className="flex items-start gap-3 cursor-pointer" onClick={() => setExpandedId(expanded ? null : rfi.id)}>
                  <StatusIcon className={`w-5 h-5 mt-0.5 ${statusColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-400">RFI-{String(rfi.rfiNumber).padStart(3, "0")}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${priorityCfg.bg} ${priorityCfg.color}`}>{t(`priority${rfi.priority.charAt(0) + rfi.priority.slice(1).toLowerCase()}`)}</span>
                      {overdue && <span className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{t("overdue")}</span>}
                    </div>
                    <p className="text-sm font-medium mt-1">{rfi.subject}</p>
                    {rfi.ballInCourt && <p className="text-xs text-gray-500">{t("ballInCourt")}: {rfi.ballInCourt}</p>}
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>

                {expanded && (
                  <div className="mt-3 ml-8 space-y-3">
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                      <p className="text-xs font-medium text-gray-500 mb-1">{t("questionLabel")}</p>
                      <p className="text-sm whitespace-pre-wrap">{rfi.question}</p>
                    </div>
                    {rfi.answer && (
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <p className="text-xs font-medium text-green-600 mb-1">{t("answerLabel")}</p>
                        <p className="text-sm whitespace-pre-wrap">{rfi.answer}</p>
                      </div>
                    )}
                    <div className="text-xs text-gray-400 flex gap-4 flex-wrap">
                      {rfi.assignedTo && <span>{t("assignedTo")}: {rfi.assignedTo.name}</span>}
                      {rfi.dueDate && <span>{t("dueDate")}: {new Date(rfi.dueDate).toLocaleDateString()}</span>}
                      <span>{t("createdBy")}: {rfi.createdBy?.name}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {rfi.status === "OPEN" && canEdit && (
                        <button onClick={() => { setAnsweringId(rfi.id); setAnswerText(""); }} className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">{t("provideAnswer")}</button>
                      )}
                      {rfi.status === "ANSWERED" && canManage && (
                        <button onClick={() => handleStatusChange(rfi.id, "CLOSED")} className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">{t("closeRFI")}</button>
                      )}
                      {rfi.status !== "VOID" && canManage && (
                        <button onClick={() => handleStatusChange(rfi.id, "VOID")} className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">{t("voidRFI")}</button>
                      )}
                      {canManage && (
                        <button onClick={() => handleDelete(rfi.id)} className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Answer form */}
                    {answeringId === rfi.id && (
                      <div className="space-y-2">
                        <textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder={t("answerPlaceholder")} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setAnsweringId(null)} className="text-xs px-3 py-1 border rounded-lg">{t("cancel")}</button>
                          <button onClick={() => handleAnswer(rfi.id)} disabled={loading || !answerText.trim()} className="text-xs px-3 py-1 bg-amber-600 text-white rounded-lg disabled:opacity-50">{t("submitAnswer")}</button>
                        </div>
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
