"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createPaymentApplication, updatePaymentAppStatus, deletePaymentApplication } from "@/actions/paymentApp";
import { toast } from "sonner";
import {
  Receipt,
  Plus,
  CheckCircle2,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Send,
  DollarSign,
} from "lucide-react";

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  DRAFT: { color: "text-gray-700", bg: "bg-gray-100" },
  SUBMITTED: { color: "text-blue-700", bg: "bg-blue-100" },
  APPROVED: { color: "text-green-700", bg: "bg-green-100" },
  REJECTED: { color: "text-red-700", bg: "bg-red-100" },
  PAID: { color: "text-emerald-700", bg: "bg-emerald-100" },
};

interface PaymentApplicationSectionProps {
  phaseId: string;
  applications: any[];
  canEdit: boolean;
  canManage: boolean;
}

export function PaymentApplicationSection({ phaseId, applications, canEdit, canManage }: PaymentApplicationSectionProps) {
  const t = useTranslations("paymentApp");
  const [items, setItems] = useState(applications);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");

  // Form state
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [scheduledValue, setScheduledValue] = useState("");
  const [workCompleted, setWorkCompleted] = useState("");
  const [materialsStored, setMaterialsStored] = useState("");
  const [retainage, setRetainage] = useState("");
  const [previousPayments, setPreviousPayments] = useState("");
  const [notes, setNotes] = useState("");

  const filtered = filter === "ALL" ? items : items.filter((i) => i.status === filter);

  const totalDue = items.reduce((sum: number, a: any) => sum + (Number(a.currentDue) || 0), 0);
  const paidTotal = items.filter((a: any) => a.status === "PAID").reduce((sum: number, a: any) => sum + (Number(a.currentDue) || 0), 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!periodStart || !periodEnd || !scheduledValue || !workCompleted) return;
    setLoading(true);
    try {
      const item = await createPaymentApplication({
        phaseId,
        periodStart,
        periodEnd,
        scheduledValue: parseFloat(scheduledValue),
        workCompleted: parseFloat(workCompleted),
        materialsStored: materialsStored ? parseFloat(materialsStored) : 0,
        retainage: retainage ? parseFloat(retainage) : 0,
        previousPayments: previousPayments ? parseFloat(previousPayments) : 0,
        notes: notes || undefined,
      });
      setItems((prev) => [{ ...item, createdBy: { name: "You" } }, ...prev]);
      setPeriodStart("");
      setPeriodEnd("");
      setScheduledValue("");
      setWorkCompleted("");
      setMaterialsStored("");
      setRetainage("");
      setPreviousPayments("");
      setNotes("");
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
      await updatePaymentAppStatus(id, status);
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
      toast.success(t("statusUpdated"));
    } catch {
      toast.error(t("errorStatus"));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deletePaymentApplication(id);
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
            <Receipt className="w-5 h-5 text-teal-500" />
            <h2 className="text-lg font-semibold">{t("title")}</h2>
            <span className="text-sm text-gray-500">({items.length})</span>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
          {canEdit && (
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-sm bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 transition-colors">
              <Plus className="w-4 h-4" /> {t("addApplication")}
            </button>
          )}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span>{t("totalDue")}: <strong className="text-gray-700">${totalDue.toLocaleString()}</strong></span>
          <span>{t("paid")}: <strong className="text-emerald-600">${paidTotal.toLocaleString()}</strong></span>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t("periodStart")}</label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t("periodEnd")}</label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t("scheduledValue")}</label>
              <input type="number" step="0.01" min="0" value={scheduledValue} onChange={(e) => setScheduledValue(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t("workCompleted")}</label>
              <input type="number" step="0.01" min="0" value={workCompleted} onChange={(e) => setWorkCompleted(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t("materialsStored")}</label>
              <input type="number" step="0.01" min="0" value={materialsStored} onChange={(e) => setMaterialsStored(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t("retainage")}</label>
              <input type="number" step="0.01" min="0" value={retainage} onChange={(e) => setRetainage(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t("previousPayments")}</label>
              <input type="number" step="0.01" min="0" value={previousPayments} onChange={(e) => setPreviousPayments(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPlaceholder")} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100">{t("cancel")}</button>
            <button type="submit" disabled={loading} className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">{t("create")}</button>
          </div>
        </form>
      )}

      {expanded && (
        <>
          <div className="flex gap-1 p-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {["ALL", "DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAID"].map((s) => (
              <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${filter === s ? "bg-teal-100 text-teal-700 font-medium" : "text-gray-500 hover:bg-gray-100"}`}>
                {t(`filter${s.charAt(0) + s.slice(1).toLowerCase()}`)}
              </button>
            ))}
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">{t("empty")}</p>
            ) : (
              filtered.map((app) => {
                const style = STATUS_STYLES[app.status] || STATUS_STYLES.DRAFT;
                return (
                  <div key={app.id} className="p-3 sm:p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <DollarSign className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">#{app.number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>{t(`status${app.status.charAt(0) + app.status.slice(1).toLowerCase()}`)}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex gap-3 flex-wrap">
                        <span className="font-semibold text-gray-700">{t("due")}: ${Number(app.currentDue).toLocaleString()}</span>
                        <span>{new Date(app.periodStart).toLocaleDateString()} – {new Date(app.periodEnd).toLocaleDateString()}</span>
                        <span>{t("scheduled")}: ${Number(app.scheduledValue).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {app.status === "DRAFT" && canEdit && (
                        <button onClick={() => handleStatusChange(app.id, "SUBMITTED")} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1">
                          <Send className="w-3 h-3" /> {t("submit")}
                        </button>
                      )}
                      {app.status === "SUBMITTED" && canManage && (
                        <>
                          <button onClick={() => handleStatusChange(app.id, "APPROVED")} className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleStatusChange(app.id, "REJECTED")} className="p-1 text-red-500 hover:bg-red-50 rounded">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {app.status === "APPROVED" && canManage && (
                        <button onClick={() => handleStatusChange(app.id, "PAID")} className="px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded">{t("markPaid")}</button>
                      )}
                      {canEdit && (
                        <button onClick={() => handleDelete(app.id)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
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
