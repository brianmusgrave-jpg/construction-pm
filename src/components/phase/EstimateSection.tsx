"use client";

/**
 * @file components/phase/EstimateSection.tsx
 * @description Phase section for managing cost estimates and takeoff line items.
 *
 * Displays a collapsible list of estimates, each with a status badge
 * (DRAFT → FINAL → APPROVED / REVISED), a running total, and an expandable
 * table of takeoff line items (description, qty, unit, unit cost, total).
 *
 * Features:
 *   - Grand total aggregates `totalCost` across all estimates in the section.
 *   - Estimates are expanded/collapsed individually via `expandedEstimate` state.
 *   - Status flow: canManage required to Finalize (DRAFT→FINAL) or Approve
 *     (FINAL→APPROVED); canEdit required to create/delete estimates and add items.
 *   - Optimistic UI: after create/add/delete, local state is updated immediately
 *     with recalculated `totalCost` before the next server render.
 *   - Toast notifications on every action success/failure (sonner).
 *
 * Server actions: `createEstimate`, `addTakeoffItem`, `deleteTakeoffItem`,
 *   `updateEstimateStatus`, `deleteEstimate` (estimate).
 * i18n namespace: `estimate`.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createEstimate, addTakeoffItem, deleteTakeoffItem, updateEstimateStatus, deleteEstimate } from "@/actions/estimate";
import { toast } from "sonner";
import {
  Calculator,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  DRAFT: { color: "text-gray-700", bg: "bg-gray-100" },
  FINAL: { color: "text-blue-700", bg: "bg-blue-100" },
  APPROVED: { color: "text-green-700", bg: "bg-green-100" },
  REVISED: { color: "text-amber-700", bg: "bg-amber-100" },
};

interface EstimateSectionProps {
  phaseId: string;
  estimates: any[];
  canEdit: boolean;
  canManage: boolean;
}

export function EstimateSection({ phaseId, estimates, canEdit, canManage }: EstimateSectionProps) {
  const t = useTranslations("estimate");
  const [items, setItems] = useState(estimates);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [expandedEstimate, setExpandedEstimate] = useState<string | null>(null);

  // Estimate form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Takeoff item form
  const [showItemForm, setShowItemForm] = useState<string | null>(null);
  const [itemDesc, setItemDesc] = useState("");
  const [itemQty, setItemQty] = useState("");
  const [itemUnit, setItemUnit] = useState("");
  const [itemUnitCost, setItemUnitCost] = useState("");
  const [itemCategory, setItemCategory] = useState("");

  const grandTotal = items.reduce((sum: number, e: any) => sum + (Number(e.totalCost) || 0), 0);

  async function handleCreateEstimate(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setLoading(true);
    try {
      const item = await createEstimate({ phaseId, name, description: description || undefined });
      setItems((prev) => [{ ...item, createdBy: { name: "You" }, items: [] }, ...prev]);
      setName("");
      setDescription("");
      setShowForm(false);
      toast.success(t("created"));
    } catch {
      toast.error(t("errorCreate"));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddItem(estimateId: string, e: React.FormEvent) {
    e.preventDefault();
    if (!itemDesc || !itemQty || !itemUnit || !itemUnitCost) return;
    setLoading(true);
    try {
      const item = await addTakeoffItem({
        estimateId,
        description: itemDesc,
        quantity: parseFloat(itemQty),
        unit: itemUnit,
        unitCost: parseFloat(itemUnitCost),
        category: itemCategory || undefined,
      });
      setItems((prev) =>
        prev.map((est) => {
          if (est.id !== estimateId) return est;
          const newItems = [...est.items, item];
          const newTotal = newItems.reduce((s: number, i: any) => s + Number(i.totalCost), 0);
          return { ...est, items: newItems, totalCost: newTotal };
        })
      );
      setItemDesc("");
      setItemQty("");
      setItemUnit("");
      setItemUnitCost("");
      setItemCategory("");
      setShowItemForm(null);
      toast.success(t("itemAdded"));
    } catch {
      toast.error(t("errorAddItem"));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteItem(itemId: string, estimateId: string) {
    try {
      await deleteTakeoffItem(itemId, estimateId);
      setItems((prev) =>
        prev.map((est) => {
          if (est.id !== estimateId) return est;
          const newItems = est.items.filter((i: any) => i.id !== itemId);
          const newTotal = newItems.reduce((s: number, i: any) => s + Number(i.totalCost), 0);
          return { ...est, items: newItems, totalCost: newTotal };
        })
      );
      toast.success(t("itemDeleted"));
    } catch {
      toast.error(t("errorDeleteItem"));
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await updateEstimateStatus(id, status);
      setItems((prev) => prev.map((e) => e.id === id ? { ...e, status } : e));
      toast.success(t("statusUpdated"));
    } catch {
      toast.error(t("errorStatus"));
    }
  }

  async function handleDeleteEstimate(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteEstimate(id);
      setItems((prev) => prev.filter((e) => e.id !== id));
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
            <Calculator className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">{t("title")}</h2>
            <span className="text-sm text-gray-500">({items.length})</span>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
          {canEdit && (
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 transition-colors">
              <Plus className="w-4 h-4" /> {t("addEstimate")}
            </button>
          )}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span>{t("grandTotal")}: <strong className="text-gray-700">${grandTotal.toLocaleString()}</strong></span>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreateEstimate} className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-3">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} className="w-full border rounded-lg px-3 py-2 text-sm" required />
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("descriptionPlaceholder")} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100">{t("cancel")}</button>
            <button type="submit" disabled={loading} className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">{t("create")}</button>
          </div>
        </form>
      )}

      {expanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">{t("empty")}</p>
          ) : (
            items.map((est) => {
              const style = STATUS_STYLES[est.status] || STATUS_STYLES.DRAFT;
              const isOpen = expandedEstimate === est.id;
              return (
                <div key={est.id}>
                  <div className="p-3 sm:p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer" onClick={() => setExpandedEstimate(isOpen ? null : est.id)}>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{est.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>{t(`status${est.status.charAt(0) + est.status.slice(1).toLowerCase()}`)}</span>
                        <span className="text-sm font-semibold text-gray-700">${Number(est.totalCost).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {est.items.length} {t("lineItems")}
                        {est.description && <span className="ml-2">— {est.description}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                      {est.status === "DRAFT" && canManage && (
                        <button onClick={() => handleStatusChange(est.id, "FINAL")} className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">{t("finalize")}</button>
                      )}
                      {est.status === "FINAL" && canManage && (
                        <button onClick={() => handleStatusChange(est.id, "APPROVED")} className="p-1 text-green-600 hover:bg-green-50 rounded">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => handleDeleteEstimate(est.id)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                      {est.items.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500">
                                <th className="text-left p-2 pl-4">{t("colDescription")}</th>
                                <th className="text-right p-2">{t("colQty")}</th>
                                <th className="text-left p-2">{t("colUnit")}</th>
                                <th className="text-right p-2">{t("colUnitCost")}</th>
                                <th className="text-right p-2">{t("colTotal")}</th>
                                <th className="p-2 w-8"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {est.items.map((item: any) => (
                                <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800">
                                  <td className="p-2 pl-4">
                                    {item.description}
                                    {item.category && <span className="ml-1 text-gray-400">({item.category})</span>}
                                  </td>
                                  <td className="text-right p-2">{Number(item.quantity).toLocaleString()}</td>
                                  <td className="p-2">{item.unit}</td>
                                  <td className="text-right p-2">${Number(item.unitCost).toLocaleString()}</td>
                                  <td className="text-right p-2 font-medium">${Number(item.totalCost).toLocaleString()}</td>
                                  <td className="p-2">
                                    {canEdit && (
                                      <button onClick={() => handleDeleteItem(item.id, est.id)} className="p-0.5 text-gray-400 hover:text-red-500">
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {showItemForm === est.id ? (
                        <form onSubmit={(e) => handleAddItem(est.id, e)} className="p-3 space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            <input type="text" value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} placeholder={t("itemDescPlaceholder")} className="col-span-2 sm:col-span-1 border rounded px-2 py-1.5 text-xs" required />
                            <input type="number" step="0.001" min="0" value={itemQty} onChange={(e) => setItemQty(e.target.value)} placeholder={t("qtyPlaceholder")} className="border rounded px-2 py-1.5 text-xs" required />
                            <input type="text" value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} placeholder={t("unitPlaceholder")} className="border rounded px-2 py-1.5 text-xs" required />
                            <input type="number" step="0.01" min="0" value={itemUnitCost} onChange={(e) => setItemUnitCost(e.target.value)} placeholder={t("unitCostPlaceholder")} className="border rounded px-2 py-1.5 text-xs" required />
                            <input type="text" value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} placeholder={t("categoryPlaceholder")} className="border rounded px-2 py-1.5 text-xs" />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setShowItemForm(null)} className="px-2 py-1 text-xs border rounded hover:bg-gray-100">{t("cancel")}</button>
                            <button type="submit" disabled={loading} className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50">{t("addItem")}</button>
                          </div>
                        </form>
                      ) : (
                        canEdit && (
                          <button onClick={() => setShowItemForm(est.id)} className="w-full p-2 text-xs text-orange-600 hover:bg-orange-50 flex items-center justify-center gap-1">
                            <Plus className="w-3 h-3" /> {t("addLineItem")}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
