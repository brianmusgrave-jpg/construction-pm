"use client";

/**
 * @file components/phase/SubcontractorBidSection.tsx
 * @description Subcontractor bid comparison and award section for a phase detail page.
 *
 * Key behaviours:
 *   - Bids are displayed sorted ascending by `amount`
 *     (`[...bids].sort((a, b) => a.amount - b.amount)`).
 *   - Lowest bid receives a "Lowest bid" badge when multiple bids exist
 *     (`lowestBid = bids.reduce((min, b) => (!min || b.amount < min.amount ? b : min), null)`).
 *   - Bid spread (max − min) is shown below the list when > 1 bid exists.
 *   - `awardBid(bid.id, !bid.awarded)` toggles the award state — only one
 *     bid can be awarded; previously awarded bids are not auto-revoked here
 *     (controlled server-side).
 *   - Awarded bid row is highlighted with a green background.
 *
 * Permissions:
 *   - `canManage` — all actions (add, award/revoke, delete).
 *
 * Server actions: `createSubcontractorBid`, `awardBid`,
 *   `deleteSubcontractorBid`.
 */

import { useState } from "react";
import {
  Briefcase,
  Plus,
  Loader2,
  AlertCircle,
  X,
  Trophy,
  Mail,
  Phone,
  User,
  DollarSign,
  Trash2,
  Award,
} from "lucide-react";
import {
  createSubcontractorBid,
  awardBid,
  deleteSubcontractorBid,
} from "@/actions/subcontractor-bids";
import type { SubcontractorBid } from "@/lib/db-types";

interface SubcontractorBidSectionProps {
  phaseId: string;
  bids: SubcontractorBid[];
  canManage: boolean;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function SubcontractorBidSection({ phaseId, bids, canManage }: SubcontractorBidSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    amount: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim() || !form.amount) return;
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount < 0) {
      setError("Enter a valid bid amount");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createSubcontractorBid({
        phaseId,
        companyName: form.companyName.trim(),
        contactName: form.contactName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        amount,
        notes: form.notes || undefined,
      });
      setForm({ companyName: "", contactName: "", email: "", phone: "", amount: "", notes: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add bid");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAward = async (bid: SubcontractorBid) => {
    setActionId(bid.id);
    try {
      await awardBid(bid.id, !bid.awarded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update bid");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this bid?")) return;
    setActionId(id);
    try {
      await deleteSubcontractorBid(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete bid");
    } finally {
      setActionId(null);
    }
  };

  const awardedBid = bids.find((b) => b.awarded);
  const lowestBid = bids.reduce<SubcontractorBid | null>((min, b) => (!min || b.amount < min.amount ? b : min), null);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-[var(--color-primary)]" />
          Subcontractor Bids
          <span className="text-xs font-normal text-gray-400 normal-case">
            ({bids.length} {bids.length === 1 ? "bid" : "bids"})
          </span>
          {awardedBid && (
            <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full normal-case flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Awarded
            </span>
          )}
        </h2>
        {canManage && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Bid</span>
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

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Company Name *</label>
              <input
                required
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                placeholder="ABC Contractors Inc."
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bid Amount ($) *</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contact Name</label>
              <input
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                placeholder="John Smith"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="john@abc.com"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(555) 123-4567"
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Scope inclusions, exclusions, qualifications..."
                rows={2}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] resize-none"
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
              Add Bid
            </button>
          </div>
        </form>
      )}

      {bids.length === 0 && !showForm ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <Briefcase className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No bids received yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...bids].sort((a, b) => a.amount - b.amount).map((bid) => (
            <div
              key={bid.id}
              className={`border rounded-lg p-3 ${
                bid.awarded
                  ? "border-green-200 bg-green-50"
                  : "border-gray-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{bid.companyName}</span>
                    {bid.awarded && (
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                        <Trophy className="w-3 h-3" /> Awarded
                      </span>
                    )}
                    {!bid.awarded && lowestBid?.id === bid.id && bids.length > 1 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        Lowest bid
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-base font-bold text-gray-800">
                      <DollarSign className="w-3 h-3 text-gray-400" />
                      {fmt(bid.amount)}
                    </span>
                    {bid.contactName && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />{bid.contactName}
                      </span>
                    )}
                    {bid.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        <a href={`mailto:${bid.email}`} className="hover:text-blue-600">{bid.email}</a>
                      </span>
                    )}
                    {bid.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />{bid.phone}
                      </span>
                    )}
                  </div>
                  {bid.notes && (
                    <p className="text-xs text-gray-500 mt-1 italic">{bid.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canManage && (
                    <button
                      onClick={() => handleAward(bid)}
                      disabled={actionId === bid.id}
                      title={bid.awarded ? "Revoke award" : "Award this bid"}
                      className={`p-1.5 rounded text-xs ${
                        bid.awarded
                          ? "text-green-600 hover:bg-green-100"
                          : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                      }`}
                    >
                      {actionId === bid.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Award className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => handleDelete(bid.id)}
                      disabled={actionId === bid.id}
                      className="p-1 text-gray-300 hover:text-red-500"
                    >
                      {actionId === bid.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {bids.length > 1 && (
            <div className="text-xs text-gray-400 text-right pt-1">
              Spread: {fmt(Math.max(...bids.map((b) => b.amount)) - Math.min(...bids.map((b) => b.amount)))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
