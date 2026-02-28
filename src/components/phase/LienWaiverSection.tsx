"use client";

/**
 * @file components/phase/LienWaiverSection.tsx
 * @description Lien waiver register for a phase detail page.
 *
 * Tracks four waiver types defined in `WAIVER_TYPE_LABELS`:
 *   CONDITIONAL_PROGRESS, UNCONDITIONAL_PROGRESS,
 *   CONDITIONAL_FINAL, UNCONDITIONAL_FINAL.
 *
 * Status workflow (advanced by `canManage` users):
 *   PENDING → RECEIVED → APPROVED  (or REJECTED at either step).
 *
 * Features:
 *   - Status filter tabs (ALL / PENDING / RECEIVED / APPROVED / REJECTED).
 *   - Summary bar shows approved count and pending-review count.
 *   - `throughDate` and optional `notarized` flag displayed per waiver row.
 *   - Collapsible section with `expanded` state.
 *
 * Permissions:
 *   - `canEdit`   — may add and delete waivers.
 *   - `canManage` — may advance status (RECEIVED, APPROVED, REJECTED).
 *
 * Server actions: `createLienWaiver`, `updateLienWaiverStatus`, `deleteLienWaiver`.
 * i18n namespace: `lienWaiver`.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createLienWaiver, updateLienWaiverStatus, deleteLienWaiver } from "@/actions/lienWaiver";
import { toast } from "sonner";
import {
  ShieldCheck,
  Plus,
  CheckCircle2,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  PENDING: { color: "text-amber-700", bg: "bg-amber-100" },
  RECEIVED: { color: "text-blue-700", bg: "bg-blue-100" },
  APPROVED: { color: "text-green-700", bg: "bg-green-100" },
  REJECTED: { color: "text-red-700", bg: "bg-red-100" },
};

const WAIVER_TYPE_LABELS: Record<string, string> = {
  CONDITIONAL_PROGRESS: "Conditional Progress",
  UNCONDITIONAL_PROGRESS: "Unconditional Progress",
  CONDITIONAL_FINAL: "Conditional Final",
  UNCONDITIONAL_FINAL: "Unconditional Final",
};

interface LienWaiverSectionProps {
  phaseId: string;
  waivers: any[];
  canEdit: boolean;
  canManage: boolean;
}

export function LienWaiverSection({ phaseId, waivers, canEdit, canManage }: LienWaiverSectionProps) {
  const confirm = useConfirmDialog();
  const t = useTranslations("lienWaiver");
  const [items, setItems] = useState(waivers);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");

  // Form state
  const [waiverType, setWaiverType] = useState("CONDITIONAL_PROGRESS");
  const [vendorName, setVendorName] = useState("");
  const [amount, setAmount] = useState("");
  const [throughDate, setThroughDate] = useState("");
  const [description, setDescription] = useState("");

  const filtered = filter === "ALL" ? items : items.filter((i) => i.status === filter);

  const pendingCount = items.filter((w: any) => w.status === "PENDING").length;
  const approvedCount = items.filter((w: any) => w.status === "APPROVED").length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorName) return;
    setLoading(true);
    try {
      const item = await createLienWaiver({
        phaseId,
        waiverType,
        vendorName,
        amount: amount ? parseFloat(amount) : undefined,
        throughDate: throughDate || undefined,
        description: description || undefined,
      });
      setItems((prev) => [{ ...item, createdBy: { name: "You" } }, ...prev]);
      setVendorName("");
      setAmount("");
      setThroughDate("");
      setDescription("");
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
      await updateLienWaiverStatus(id, status);
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
      toast.success(t("statusUpdated"));
    } catch {
      toast.error(t("errorStatus"));
    }
  }

  async function handleDelete(id: string) {
    if (!await confirm(t("confirmDelete"), { danger: true })) return;
    try {
      await deleteLienWaiver(id);
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
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold">{t("title")}</h2>
            <span className="text-sm text-gray-500">({items.length})</span>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
          {canEdit && (
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus className="w-4 h-4" /> {t("addWaiver")}
            </button>
          )}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span>{t("approved")}: <strong className="text-green-600">{approvedCount}</strong></span>
          {pendingCount > 0 && <span className="text-amber-600">{pendingCount} {t("pendingReview")}</span>}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select value={waiverType} onChange={(e) => setWaiverType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="CONDITIONAL_PROGRESS">{t("typeConditionalProgress")}</option>
              <option value="UNCONDITIONAL_PROGRESS">{t("typeUnconditionalProgress")}</option>
              <option value="CONDITIONAL_FINAL">{t("typeConditionalFinal")}</option>
              <option value="UNCONDITIONAL_FINAL">{t("typeUnconditionalFinal")}</option>
            </select>
            <input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder={t("vendorPlaceholder")} className="border rounded-lg px-3 py-2 text-sm" required />
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("amountPlaceholder")} className="border rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={throughDate} onChange={(e) => setThroughDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
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
          <div className="flex gap-1 p-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {["ALL", "PENDING", "RECEIVED", "APPROVED", "REJECTED"].map((s) => (
              <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${filter === s ? "bg-indigo-100 text-indigo-700 font-medium" : "text-gray-500 hover:bg-gray-100"}`}>
                {t(`filter${s.charAt(0) + s.slice(1).toLowerCase()}`)}
              </button>
            ))}
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">{t("empty")}</p>
            ) : (
              filtered.map((waiver) => {
                const style = STATUS_STYLES[waiver.status] || STATUS_STYLES.PENDING;
                return (
                  <div key={waiver.id} className="p-3 sm:p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{waiver.vendorName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>{t(`status${waiver.status.charAt(0) + waiver.status.slice(1).toLowerCase()}`)}</span>
                        <span className="text-xs text-gray-400">{WAIVER_TYPE_LABELS[waiver.waiverType] || waiver.waiverType}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                        {waiver.amount && <span className="font-semibold text-gray-700">${Number(waiver.amount).toLocaleString()}</span>}
                        {waiver.throughDate && <span>{t("through")} {new Date(waiver.throughDate).toLocaleDateString()}</span>}
                        {waiver.notarized && <span className="text-green-600">{t("notarized")}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {waiver.status === "PENDING" && canManage && (
                        <>
                          <button onClick={() => handleStatusChange(waiver.id, "RECEIVED")} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">{t("markReceived")}</button>
                          <button onClick={() => handleStatusChange(waiver.id, "APPROVED")} className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleStatusChange(waiver.id, "REJECTED")} className="p-1 text-red-500 hover:bg-red-50 rounded">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {waiver.status === "RECEIVED" && canManage && (
                        <>
                          <button onClick={() => handleStatusChange(waiver.id, "APPROVED")} className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleStatusChange(waiver.id, "REJECTED")} className="p-1 text-red-500 hover:bg-red-50 rounded">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {canEdit && (
                        <button onClick={() => handleDelete(waiver.id)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
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
