"use client";

/**
 * @file system-admin/orgs/[orgId]/page.tsx
 * @description Org detail page for SYSTEM_ADMIN God Mode.
 *
 * Tabbed layout with four sections:
 *   1. Overview  — org info, plan/status badges, AI usage, subscription
 *   2. Users     — user table with impersonation buttons and role badges
 *   3. Projects  — project list with phase counts and status
 *   4. Tools     — fix-it tools (resend invite, reset password, clear stuck phases),
 *                  feature flag toggles, subscription management
 *
 * All mutating actions log to SystemAdminLog for auditability.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getOrgDetail,
  createImpersonationToken,
  toggleOrgFeature,
  changeOrgPlan,
  changeOrgStatus,
  extendTrial,
  resetAiTokenUsage,
  setAiTokenBudget,
  resendInvite,
  resetUserPassword,
  clearStuckPhases,
} from "@/actions/system-admin";

type Tab = "overview" | "users" | "projects" | "tools";

export default function OrgDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [orgId]);

  async function loadData() {
    try {
      const d = await getOrgDetail(orgId);
      setData(d);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /** Show a brief success message, auto-dismiss after 3s */
  function flash(msg: string) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 3000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-red-500">Organization not found.</p>;
  }

  const { org, users, projects, features, subscription } = data;
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "users", label: `Users (${users.length})` },
    { key: "projects", label: `Projects (${projects.length})` },
    { key: "tools", label: "Tools" },
  ];

  return (
    <div className="space-y-6">
      {/* Flash message */}
      {actionMsg && (
        <div className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-4 py-2 rounded-lg text-sm font-medium">
          {actionMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/system-admin")}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{org.name}</h1>
        <span className="text-sm text-gray-400">/{org.slug}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.key
                ? "bg-white dark:bg-gray-800 text-red-600 border-b-2 border-red-600"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {activeTab === "overview" && (
          <OverviewTab org={org} subscription={subscription} features={features} />
        )}
        {activeTab === "users" && (
          <UsersTab orgId={orgId} users={users} flash={flash} reload={loadData} />
        )}
        {activeTab === "projects" && <ProjectsTab projects={projects} />}
        {activeTab === "tools" && (
          <ToolsTab
            orgId={orgId}
            org={org}
            features={features}
            users={users}
            projects={projects}
            flash={flash}
            reload={loadData}
          />
        )}
      </div>
    </div>
  );
}

// ── Overview Tab ──

function OverviewTab({ org, subscription, features }: any) {
  const aiPct = org.aiTokenBudget > 0
    ? Math.round((org.aiTokenUsed / org.aiTokenBudget) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Org Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoCard label="Plan" value={org.plan} />
        <InfoCard label="Status" value={org.status} />
        <InfoCard label="Created" value={new Date(org.createdAt).toLocaleDateString()} />
        <InfoCard
          label="Billing Cycle End"
          value={org.billingCycleEnd ? new Date(org.billingCycleEnd).toLocaleDateString() : "—"}
        />
      </div>

      {/* AI Usage */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">AI Token Usage</h3>
        <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              aiPct > 90 ? "bg-red-500" : aiPct > 70 ? "bg-yellow-500" : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(aiPct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {org.aiTokenUsed.toLocaleString()} / {org.aiTokenBudget.toLocaleString()} tokens ({aiPct}%)
        </p>
      </div>

      {/* Stripe IDs */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Stripe</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Customer: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{org.stripeCustomerId ?? "Not connected"}</code>
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
          Subscription: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{org.stripeSubId ?? "None"}</code>
        </p>
      </div>

      {/* Active Feature Flags */}
      {features.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Feature Flags</h3>
          <div className="flex flex-wrap gap-2">
            {features.map((f: any) => (
              <span
                key={f.id}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  f.enabled
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 line-through"
                }`}
              >
                {f.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

// ── Users Tab ──

function UsersTab({ orgId, users, flash, reload }: any) {
  async function handleImpersonate(userId: string, userName: string) {
    if (!confirm(`Impersonate ${userName}? This creates a 30-min session token.`)) return;
    try {
      const { token } = await createImpersonationToken(userId);
      // Copy the impersonation URL to clipboard
      const url = `${window.location.origin}/api/impersonate?token=${token}`;
      await navigator.clipboard.writeText(url);
      flash(`Impersonation URL copied to clipboard (30 min expiry)`);
    } catch (err: any) {
      flash(`Error: ${err.message}`);
    }
  }

  async function handleResetPassword(userId: string, userName: string) {
    if (!confirm(`Generate a password reset link for ${userName}?`)) return;
    try {
      const { inviteUrl } = await resetUserPassword(orgId, userId);
      const fullUrl = `${window.location.origin}${inviteUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      flash(`Password reset link copied for ${userName}`);
    } catch (err: any) {
      flash(`Error: ${err.message}`);
    }
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">User</th>
            <th className="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Role</th>
            <th className="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Joined</th>
            <th className="text-right px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
          {users.map((u: any) => (
            <tr key={u.id}>
              <td className="px-3 py-2">
                <p className="font-medium text-gray-900 dark:text-white">
                  {u.name ?? "—"}
                  {u.isOrgOwner && (
                    <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                      OWNER
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400">{u.email}</p>
              </td>
              <td className="px-3 py-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{u.role}</span>
              </td>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                {new Date(u.createdAt).toLocaleDateString()}
              </td>
              <td className="px-3 py-2 text-right space-x-2">
                <button
                  onClick={() => handleImpersonate(u.id, u.name ?? u.email)}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium"
                >
                  Impersonate
                </button>
                <button
                  onClick={() => handleResetPassword(u.id, u.name ?? u.email)}
                  className="text-xs text-orange-600 hover:text-orange-800 dark:text-orange-400 font-medium"
                >
                  Reset PW
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Projects Tab ──

function ProjectsTab({ projects }: any) {
  return (
    <div>
      {projects.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No projects in this organization.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Project</th>
              <th className="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Status</th>
              <th className="text-right px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Phases</th>
              <th className="text-left px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            {projects.map((p: any) => (
              <tr key={p.id}>
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{p.name}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    p.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                    p.status === "ARCHIVED" ? "bg-gray-100 text-gray-600" :
                    "bg-blue-100 text-blue-800"
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{p.phaseCount}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Tools Tab ──

function ToolsTab({ orgId, org, features, users, projects, flash, reload }: any) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [newBudget, setNewBudget] = useState(String(org.aiTokenBudget));
  const [trialDays, setTrialDays] = useState("14");

  // ── Plan Management ──
  async function handleChangePlan(plan: string) {
    if (!confirm(`Change plan to ${plan}?`)) return;
    try {
      await changeOrgPlan(orgId, plan);
      flash(`Plan changed to ${plan}`);
      reload();
    } catch (err: any) { flash(`Error: ${err.message}`); }
  }

  async function handleChangeStatus(status: string) {
    if (!confirm(`Change status to ${status}?`)) return;
    try {
      await changeOrgStatus(orgId, status);
      flash(`Status changed to ${status}`);
      reload();
    } catch (err: any) { flash(`Error: ${err.message}`); }
  }

  async function handleExtendTrial() {
    const days = parseInt(trialDays);
    if (isNaN(days) || days < 1) { flash("Invalid number of days"); return; }
    try {
      const { billingCycleEnd } = await extendTrial(orgId, days);
      flash(`Trial extended — new end: ${new Date(billingCycleEnd).toLocaleDateString()}`);
      reload();
    } catch (err: any) { flash(`Error: ${err.message}`); }
  }

  // ── AI Budget ──
  async function handleResetAi() {
    if (!confirm("Reset AI token usage to 0?")) return;
    try {
      await resetAiTokenUsage(orgId);
      flash("AI token usage reset to 0");
      reload();
    } catch (err: any) { flash(`Error: ${err.message}`); }
  }

  async function handleSetBudget() {
    const b = parseInt(newBudget);
    if (isNaN(b) || b < 0) { flash("Invalid budget"); return; }
    try {
      await setAiTokenBudget(orgId, b);
      flash(`AI budget set to ${b.toLocaleString()}`);
      reload();
    } catch (err: any) { flash(`Error: ${err.message}`); }
  }

  // ── Feature Flags ──
  async function handleToggleFeature(name: string, current: boolean) {
    try {
      await toggleOrgFeature(orgId, name, !current);
      flash(`${name} → ${!current ? "ON" : "OFF"}`);
      reload();
    } catch (err: any) { flash(`Error: ${err.message}`); }
  }

  // ── Fix-It: Invite ──
  async function handleResendInvite() {
    if (!inviteEmail.trim()) { flash("Enter an email"); return; }
    try {
      const { inviteUrl } = await resendInvite(orgId, inviteEmail.trim(), inviteRole);
      const fullUrl = `${window.location.origin}${inviteUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      flash(`Invite link copied for ${inviteEmail}`);
      setInviteEmail("");
    } catch (err: any) { flash(`Error: ${err.message}`); }
  }

  // ── Fix-It: Stuck Phases ──
  async function handleClearStuck(projectId: string, projectName: string) {
    if (!confirm(`Reset stuck phases (>30 days idle) in "${projectName}"?`)) return;
    try {
      const { phasesReset } = await clearStuckPhases(orgId, projectId);
      flash(`${phasesReset} stuck phase(s) reset in "${projectName}"`);
    } catch (err: any) { flash(`Error: ${err.message}`); }
  }

  return (
    <div className="space-y-8">
      {/* Plan & Status Management */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Subscription Management</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Plan selector */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
              Plan (current: <strong>{org.plan}</strong>)
            </p>
            <div className="flex gap-2">
              {["STARTER", "PRO", "ENTERPRISE"].map((p) => (
                <button
                  key={p}
                  onClick={() => handleChangePlan(p)}
                  disabled={org.plan === p}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    org.plan === p
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900 border border-gray-300 dark:border-gray-500"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Status selector */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
              Status (current: <strong>{org.status}</strong>)
            </p>
            <div className="flex gap-2 flex-wrap">
              {["ACTIVE", "TRIAL", "PAST_DUE", "SUSPENDED", "CANCELLED"].map((s) => (
                <button
                  key={s}
                  onClick={() => handleChangeStatus(s)}
                  disabled={org.status === s}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    org.status === s
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900 border border-gray-300 dark:border-gray-500"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Trial extension */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Extend Trial</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="365"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                className="w-20 px-2 py-1.5 border rounded text-sm dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              />
              <span className="text-sm text-gray-500">days</span>
              <button
                onClick={handleExtendTrial}
                className="px-3 py-1.5 bg-yellow-500 text-white rounded text-xs font-medium hover:bg-yellow-600"
              >
                Extend
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* AI Token Management */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">AI Usage</h3>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            Used: <strong>{org.aiTokenUsed.toLocaleString()}</strong> / {org.aiTokenBudget.toLocaleString()} tokens
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleResetAi}
              className="px-3 py-1.5 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600"
            >
              Reset Usage to 0
            </button>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                className="w-32 px-2 py-1.5 border rounded text-sm dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              />
              <button
                onClick={handleSetBudget}
                className="px-3 py-1.5 bg-purple-500 text-white rounded text-xs font-medium hover:bg-purple-600"
              >
                Set Budget
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Flags */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Feature Flags</h3>
        {features.length === 0 ? (
          <p className="text-sm text-gray-400">No feature flags configured for this org.</p>
        ) : (
          <div className="space-y-2">
            {features.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{f.name}</span>
                <button
                  onClick={() => handleToggleFeature(f.name, f.enabled)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    f.enabled
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : "bg-gray-300 text-gray-600 hover:bg-gray-400"
                  }`}
                >
                  {f.enabled ? "ON" : "OFF"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fix-It Tools */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Fix-It Tools</h3>
        <div className="space-y-4">
          {/* Resend Invite */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Send New Invite</p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="email"
                placeholder="email@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-1.5 border rounded text-sm dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-2 py-1.5 border rounded text-sm dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              >
                <option value="VIEWER">Viewer</option>
                <option value="CONTRACTOR">Contractor</option>
                <option value="STAKEHOLDER">Stakeholder</option>
                <option value="PROJECT_MANAGER">PM</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button
                onClick={handleResendInvite}
                className="px-3 py-1.5 bg-orange-500 text-white rounded text-xs font-medium hover:bg-orange-600"
              >
                Send & Copy Link
              </button>
            </div>
          </div>

          {/* Clear Stuck Phases */}
          {projects.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                Clear Stuck Phases (IN_PROGRESS &gt; 30 days idle)
              </p>
              <div className="flex gap-2 flex-wrap">
                {projects.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => handleClearStuck(p.id, p.name)}
                    className="px-3 py-1.5 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded text-xs font-medium hover:bg-red-200 dark:hover:bg-red-800"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
