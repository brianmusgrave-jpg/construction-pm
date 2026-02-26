"use client";

/**
 * @file components/phase/MaterialSection.tsx
 * @description Material tracking section for a phase detail page.
 *
 * Tracks materials through four statuses defined in `STATUS_CONFIG`:
 *   ORDERED (ShoppingCart), DELIVERED (Truck), INSTALLED (Hammer),
 *   RETURNED (RotateCcw) — each with a distinct colour and icon.
 *
 * Key behaviours:
 *   - Total cost: `materials.reduce((sum, m) => sum + (m.cost ?? 0) * m.quantity, 0)`.
 *   - Status summary pills appear at the top when at least one material exists.
 *   - Status change uses a CSS `group-hover` dropdown overlay on each row,
 *     allowing quick inline status edits without a modal.
 *   - Supported units: ea, lf, sf, sy, cy, ton, lb, gal, bag, pcs, set.
 *   - `fmt` helper formats USD amounts with `Intl.NumberFormat`.
 *
 * Permissions:
 *   - `canManage` — controls all add / status-change / delete actions.
 *
 * Server actions: `createMaterial`, `updateMaterialStatus`, `deleteMaterial`.
 */

import { useState } from "react";
import {
  Package,
  Plus,
  Loader2,
  AlertCircle,
  X,
  Trash2,
  ChevronDown,
  Truck,
  Hammer,
  ShoppingCart,
  RotateCcw,
} from "lucide-react";
import { createMaterial, updateMaterialStatus, deleteMaterial } from "@/actions/materials";
import type { Material, MaterialStatus } from "@/lib/db-types";

interface MaterialSectionProps {
  phaseId: string;
  materials: Material[];
  canManage: boolean;
}

const STATUS_CONFIG: Record<MaterialStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  ORDERED: { label: "Ordered", color: "text-blue-600", bg: "bg-blue-50", icon: ShoppingCart },
  DELIVERED: { label: "Delivered", color: "text-amber-600", bg: "bg-amber-50", icon: Truck },
  INSTALLED: { label: "Installed", color: "text-green-600", bg: "bg-green-50", icon: Hammer },
  RETURNED: { label: "Returned", color: "text-gray-500", bg: "bg-gray-100", icon: RotateCcw },
};

const STATUS_ORDER: MaterialStatus[] = ["ORDERED", "DELIVERED", "INSTALLED", "RETURNED"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function MaterialSection({ phaseId, materials, canManage }: MaterialSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    quantity: "",
    unit: "ea",
    cost: "",
    supplier: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.quantity) return;
    setSubmitting(true);
    setError(null);
    try {
      await createMaterial({
        phaseId,
        name: form.name.trim(),
        quantity: parseFloat(form.quantity),
        unit: form.unit,
        cost: form.cost ? parseFloat(form.cost) : undefined,
        supplier: form.supplier || undefined,
        notes: form.notes || undefined,
      });
      setForm({ name: "", quantity: "", unit: "ea", cost: "", supplier: "", notes: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add material");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (mat: Material, status: MaterialStatus) => {
    setActionId(mat.id);
    try {
      await updateMaterialStatus(mat.id, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this material?")) return;
    setActionId(id);
    try {
      await deleteMaterial(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setActionId(null);
    }
  };

  const totalCost = materials.reduce((sum, m) => sum + (m.cost ?? 0) * m.quantity, 0);
  const byStatus = STATUS_ORDER.map((s) => ({
    status: s,
    count: materials.filter((m) => m.status === s).length,
  })).filter((g) => g.count > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          <Package className="w-4 h-4 text-[var(--color-primary)]" />
          Materials
          <span className="text-xs font-normal text-gray-400 normal-case">
            ({materials.length} items)
          </span>
          {totalCost > 0 && (
            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-full normal-case">
              {fmt(totalCost)}
            </span>
          )}
        </h2>
        {canManage && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        )}
      </div>

      {/* Status summary pills */}
      {byStatus.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {byStatus.map(({ status, count }) => {
            const cfg = STATUS_CONFIG[status];
            return (
              <span key={status} className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} flex items-center gap-1`}>
                <cfg.icon className="w-3 h-3" />
                {count} {cfg.label}
              </span>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Material Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 2x4 Lumber"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Quantity *</label>
              <input
                required
                type="number"
                min="0"
                step="any"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
              <select
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              >
                {["ea", "lf", "sf", "sy", "cy", "ton", "lb", "gal", "bag", "pcs", "set"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unit Cost ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Supplier</label>
              <input
                value={form.supplier}
                onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                placeholder="e.g. Home Depot"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-md disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Add Material
            </button>
          </div>
        </form>
      )}

      {materials.length === 0 && !showForm ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No materials tracked yet</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {materials.map((mat) => {
            const cfg = STATUS_CONFIG[mat.status];
            const StatusIcon = cfg.icon;
            return (
              <div key={mat.id} className="flex items-center gap-3 p-2.5 border border-gray-100 rounded-lg group hover:bg-gray-50">
                <StatusIcon className={`w-4 h-4 ${cfg.color} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{mat.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {mat.quantity} {mat.unit}
                    </span>
                    {mat.cost != null && (
                      <span className="text-xs text-gray-400 shrink-0">
                        @ {fmt(mat.cost)}/{mat.unit} = {fmt(mat.cost * mat.quantity)}
                      </span>
                    )}
                  </div>
                  {mat.supplier && (
                    <p className="text-xs text-gray-400 mt-0.5">{mat.supplier}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canManage && (
                    <div className="relative group/status">
                      <button
                        className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} flex items-center gap-1 hover:opacity-80`}
                        disabled={actionId === mat.id}
                      >
                        {actionId === mat.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            {cfg.label}
                            <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                      <div className="absolute right-0 top-full mt-1 hidden group-hover/status:block z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]">
                        {STATUS_ORDER.map((s) => {
                          const sc = STATUS_CONFIG[s];
                          return (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(mat, s)}
                              className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 ${s === mat.status ? "font-medium" : ""}`}
                            >
                              <sc.icon className={`w-3 h-3 ${sc.color}`} />
                              {sc.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {canManage && (
                    <button
                      onClick={() => handleDelete(mat.id)}
                      disabled={actionId === mat.id}
                      className="p-1 text-gray-300 sm:opacity-0 sm:group-hover:opacity-100 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
