/**
 * @file src/components/settings/BillingClient.tsx
 * @description Client component for the billing settings page (Sprint 14).
 *
 * Renders five sections:
 *   1. Current Plan — plan name, price, renewal date, upgrade/cancel buttons
 *   2. AI Usage — token consumption progress bar with budget info
 *   3. Add-On Features — feature matrix with included/locked badges
 *   4. Payment Method — stub card display (Stripe portal link in Sprint 15)
 *   5. Invoice History — table of past invoices (populated via Stripe in Sprint 15)
 *   6. Ownership Transfer — owner-only section to transfer billing ownership
 */
"use client";

import { useState } from "react";
import {
  CreditCard,
  Zap,
  Crown,
  ArrowUpRight,
  Check,
  Lock,
  RefreshCw,
  UserCheck,
  AlertTriangle,
  FileText,
  Receipt,
  Building2,
  Users,
  FolderKanban,
} from "lucide-react";
import { toast } from "sonner";
import { transferOwnership } from "@/actions/billing";
import type { BillingInfo, Invoice, OrgAdminUser } from "@/actions/billing";

interface BillingClientProps {
  billingInfo: BillingInfo;
  invoices: Invoice[];
  adminUsers: OrgAdminUser[];
  isOwner: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helper: format date string                                         */
/* ------------------------------------------------------------------ */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Plan badge colors                                                  */
/* ------------------------------------------------------------------ */
function planColor(plan: string): string {
  switch (plan) {
    case "ENTERPRISE": return "bg-purple-100 text-purple-800 border-purple-200";
    case "PRO": return "bg-blue-100 text-blue-800 border-blue-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function statusBadge(status: string): { color: string; label: string } {
  switch (status) {
    case "ACTIVE": return { color: "bg-green-100 text-green-800", label: "Active" };
    case "TRIAL": return { color: "bg-yellow-100 text-yellow-800", label: "Trial" };
    case "PAST_DUE": return { color: "bg-red-100 text-red-800", label: "Past Due" };
    case "SUSPENDED": return { color: "bg-red-100 text-red-800", label: "Suspended" };
    case "CANCELLED": return { color: "bg-gray-100 text-gray-600", label: "Cancelled" };
    default: return { color: "bg-gray-100 text-gray-600", label: status };
  }
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function BillingClient({ billingInfo, invoices, adminUsers, isOwner }: BillingClientProps) {
  const [transferTarget, setTransferTarget] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);

  const b = billingInfo;
  const pd = b.planDetails;
  const sb = statusBadge(b.status);

  /** Handle ownership transfer with confirmation. */
  async function handleTransfer() {
    if (!transferTarget) return;
    setTransferring(true);
    try {
      await transferOwnership(transferTarget);
      toast.success("Ownership transferred successfully. Please sign out and sign back in.");
      setShowTransferConfirm(false);
      setTransferTarget("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransferring(false);
    }
  }

  /** Renewal/period end date. */
  const renewalDate = b.subscription?.currentPeriodEnd
    ? formatDate(b.subscription.currentPeriodEnd)
    : b.billingCycleEnd
    ? formatDate(b.billingCycleEnd)
    : "—";

  return (
    <div className="space-y-6">
      {/* ── Section 1: Current Plan ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Crown className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
          <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold border ${planColor(b.plan)}`}>
            {pd.label}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sb.color}`}>
            {sb.label}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Price</p>
            <p className="text-lg font-bold text-gray-900">{pd.price}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Renews</p>
            <p className="text-lg font-bold text-gray-900">{renewalDate}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Users className="w-3 h-3" /> Users
            </p>
            <p className="text-lg font-bold text-gray-900">
              {b.userCount} / {pd.maxUsers ?? "∞"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <FolderKanban className="w-3 h-3" /> Projects
            </p>
            <p className="text-lg font-bold text-gray-900">
              {b.projectCount} / {pd.maxProjects ?? "∞"}
            </p>
          </div>
        </div>

        {b.subscription?.cancelAtPeriodEnd && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Plan will be cancelled at the end of the current billing period ({renewalDate}).
          </div>
        )}

        <div className="flex gap-3 mt-4">
          {b.plan !== "ENTERPRISE" && (
            <button
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => toast.info("Upgrade flow will be available with Stripe integration (Sprint 15).")}
            >
              <ArrowUpRight className="w-4 h-4" />
              {b.plan === "STARTER" ? "Upgrade to Pro" : "Upgrade to Enterprise"}
            </button>
          )}
          <button
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            onClick={() => toast.info("Plan management will be available with Stripe integration (Sprint 15).")}
          >
            {b.plan === "ENTERPRISE" ? "Manage Plan" : "Cancel Plan"}
          </button>
        </div>
      </div>

      {/* ── Section 2: AI Usage ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900">AI Usage This Billing Cycle</h2>
        </div>

        {pd.aiTokens === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <Lock className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">AI features not included in Starter plan</p>
              <p className="text-xs text-gray-500">Upgrade to Pro to unlock AI Voice Transcription, Task Extraction, and more.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-end justify-between">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{b.aiTokenUsed.toLocaleString()}</span>
                {" / "}
                <span>{b.aiTokenBudget.toLocaleString()}</span> tokens used
              </p>
              <p className="text-xs text-gray-500">
                ~${((b.aiTokenUsed / 1000) * 0.03).toFixed(2)} equivalent
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  b.aiUsagePercent > 90 ? "bg-red-500" : b.aiUsagePercent > 70 ? "bg-amber-500" : "bg-blue-500"
                }`}
                style={{ width: `${Math.min(b.aiUsagePercent, 100)}%` }}
              />
            </div>
            {b.aiUsagePercent > 90 && (
              <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {b.aiUsagePercent >= 100
                  ? "AI token budget exhausted. Contact your admin for an increase."
                  : `${b.aiUsagePercent}% of AI budget used. Consider requesting a limit increase.`
                }
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Resets {renewalDate !== "—" ? `on ${renewalDate}` : "at the start of your next billing cycle"}.
            </p>
          </>
        )}
      </div>

      {/* ── Section 3: Add-On Features ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-gray-900">Feature Access</h2>
        </div>

        <div className="space-y-2">
          {[
            { name: "AI Voice Transcription", plan: "PRO" },
            { name: "AI Task Extraction", plan: "PRO" },
            { name: "QuickBooks Integration", plan: "PRO" },
            { name: "API & Webhooks", plan: "PRO" },
            { name: "Advanced Analytics", plan: "PRO" },
            { name: "White Label / Custom Domain", plan: "ENTERPRISE" },
            { name: "Priority Support", plan: "ENTERPRISE" },
            { name: "SSO / SAML", plan: "ENTERPRISE" },
          ].map((feature) => {
            const planOrder = { STARTER: 0, PRO: 1, ENTERPRISE: 2 };
            const currentLevel = planOrder[b.plan as keyof typeof planOrder] ?? 0;
            const requiredLevel = planOrder[feature.plan as keyof typeof planOrder] ?? 0;
            const included = currentLevel >= requiredLevel;

            return (
              <div
                key={feature.name}
                className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50"
              >
                {included ? (
                  <Check className="w-4 h-4 text-green-600 shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                <span className={`text-sm ${included ? "text-gray-900" : "text-gray-500"}`}>
                  {feature.name}
                </span>
                {!included && (
                  <span className="ml-auto text-xs text-gray-400">
                    {feature.plan === "ENTERPRISE" ? "Enterprise" : "Pro"} plan
                  </span>
                )}
                {included && (
                  <span className="ml-auto text-xs text-green-600 font-medium">Included</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 4: Payment Method ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Payment Method</h2>
        </div>

        {b.stripeCustomerId ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Card on file</p>
              <p className="text-xs text-gray-500">Managed via Stripe</p>
            </div>
            <button
              className="ml-auto inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
              onClick={() => toast.info("Stripe customer portal will be available in Sprint 15.")}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Update
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <CreditCard className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">No payment method on file</p>
              <p className="text-xs text-gray-500">
                Payment collection will be set up with Stripe integration (Sprint 15).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 5: Invoice History ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Receipt className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Invoice History</h2>
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No invoices yet</p>
            <p className="text-xs mt-1">Invoices will appear here once Stripe billing is active.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b">
                <th className="pb-2">Date</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-3">{formatDate(inv.date)}</td>
                  <td className="py-3 font-medium">{inv.amount}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      inv.status === "paid" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {inv.pdfUrl && (
                      <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 text-xs">
                        Download PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Section 6: Ownership Transfer (owner only) ── */}
      {isOwner && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <UserCheck className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Transfer Ownership</h2>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Transfer billing ownership to another Admin user in your organization.
            The new owner will manage the subscription and billing details.
          </p>

          {adminUsers.filter((u) => !u.isOrgOwner).length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No other Admin users available. Invite or promote a user to Admin before transferring ownership.
            </p>
          ) : (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Transfer to
                </label>
                <select
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select an Admin user...</option>
                  {adminUsers
                    .filter((u) => !u.isOrgOwner)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email} ({u.email})
                      </option>
                    ))}
                </select>
              </div>
              <button
                disabled={!transferTarget || transferring}
                onClick={() => setShowTransferConfirm(true)}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {transferring ? "Transferring..." : "Transfer"}
              </button>
            </div>
          )}

          {/* Confirmation modal */}
          {showTransferConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Ownership Transfer</h3>
                <p className="text-sm text-gray-600 mb-4">
                  This action will transfer billing ownership to{" "}
                  <strong>{adminUsers.find((u) => u.id === transferTarget)?.name || "the selected user"}</strong>.
                  You will no longer be the org owner. This cannot be undone from this page.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowTransferConfirm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTransfer}
                    disabled={transferring}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {transferring ? "Transferring..." : "Yes, Transfer Ownership"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
