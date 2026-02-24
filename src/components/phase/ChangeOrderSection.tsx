"use client";

import { useState } from "react";
import {
  FileDiff,
  Plus,
  Check,
  X,
  Trash2,
  Loader2,
  ChevronDown,
  AlertCircle,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  createChangeOrder,
  updateChangeOrderStatus,
  deleteChangeOrder,
} from "@/actions/change-orders";
import type { ChangeOrder } from "@/lib/db-types";

interface ChangeOrderSectionProps {
  phaseId: string;
  changeOrders: ChangeOrder[];
  canCreate: boolean;
  canApprove: boolean;
}

const STATUS_CONFIG: Record<
  string,
  { icon: typeof Clock; color: string; bg: string; label: string }
> = {
  PENDING: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", label: "Pending" },
  APPROVED: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", label: "Approved" },
  REJECTED: { icon: XCircle, color: "text-red-500", bg: "bg-red-50", label: "Rejected" },
};

function fmtAmount(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function ChangeOrderSection({
  phaseId,
  changeOrders,
  canCreate,
  canApprove,
}: ChangeOrderSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    number: "",
    title: "",
    description: "",
    amount: "",
    reason: "",
  });

  const totalApproved = changeOrders
    .filter((co) => co.status === "APPROVED" && co.amount)
    .reduce((sum, co) => sum + Number(co.amount), 0);

  const pendingCount = changeOrders.filter((co) => co.status === "PENDING").length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.number.trim() || !form.title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createChangeOrder({
        phaseId,
        number: form.number.trim(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        amount: form.amount ? Number(form.amount) : undefined,
        reason: form.reason.trim() || undefined,
      });
      setForm({ number: "", title: "", description: "", amount: "", reason: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create change order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async (id: string, status: "APPROVED" | "REJECTED") => {
    setActionId(id);
    setError(null);
    try {
      await updateChangeOrderStatus(id, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this change order?")) return;
    setActionId(id);
    try {
      await deleteChangeOrder(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Change Orders
          </h2>
          {pendingCount > 0 && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {totalApproved > 0 && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {fmtAmount(totalApproved)} approved
            </span>
          )}
          {canCreate && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New CO</span>
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* New CO form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">CO Number *</label>
              <input
                required
                value={form.number}
                onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                placeholder="CO-001"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount ($)</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Brief description of the change"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
            <input
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Why is this change needed?"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Detailed description..."
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] resize-none"
            />
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
              Submit CO
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {changeOrders.length === 0 && !showForm ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <FileDiff className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No change orders</p>
          {canCreate && (
            <p className="text-xs text-gray-400 mt-1">Click "New CO" to submit a change order</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {changeOrders.map((co) => {
            const cfg = STATUS_CONFIG[co.status] ?? STATUS_CONFIG.PENDING;
            const StatusIcon = cfg.icon;
            return (
              <div
                key={co.id}
                className="border border-gray-100 rounded-lg p-3 hover:border-gray-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-500">{co.number}</span>
                      <span className="text-sm font-medium text-gray-900 truncate">{co.title}</span>
                      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    {co.reason && (
                      <p className="text-xs text-gray-500 mt-0.5">{co.reason}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {co.amount != null && (
                        <span className="font-medium text-gray-700">{fmtAmount(co.amount)}</span>
                      )}
                      <span>{co.requestedBy?.name || co.requestedBy?.email || "—"}</span>
                      <span>{new Date(co.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Approve/Reject (PM/Admin on pending COs) */}
                    {canApprove && co.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleStatus(co.id, "APPROVED")}
                          disabled={actionId === co.id}
                          title="Approve"
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                        >
                          {actionId === co.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleStatus(co.id, "REJECTED")}
                          disabled={actionId === co.id}
                          title="Reject"
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {/* Delete */}
                    {canApprove && (
                      <button
                        onClick={() => handleDelete(co.id)}
                        disabled={actionId === co.id}
                        title="Delete"
                        className="p-1.5 text-gray-300 sm:opacity-0 sm:group-hover:opacity-100 hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
