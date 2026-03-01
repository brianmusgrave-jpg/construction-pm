"use client";

/**
 * @file system-admin/page.tsx
 * @description Organization overview — the landing page for SYSTEM_ADMIN God Mode.
 *
 * Shows KPI cards (total orgs, users, projects) and a clickable org table.
 * Clicking an org row navigates to /system-admin/orgs/[orgId] for the detail view.
 * Includes a search filter and quick-action links to the audit log.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSystemAdminStats } from "@/actions/admin";

interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  userCount: number;
  projectCount: number;
  createdAt: string;
}

interface AdminStats {
  totalOrgs: number;
  totalUsers: number;
  totalProjects: number;
  orgs: OrgSummary[];
}

/** Plan badge color mapping */
function planColor(plan: string) {
  if (plan === "ENTERPRISE") return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
  if (plan === "PRO") return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
}

/** Status badge color mapping */
function statusColor(status: string) {
  if (status === "ACTIVE") return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (status === "TRIAL") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  if (status === "SUSPENDED") return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
}

export default function SystemAdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getSystemAdminStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-red-500">Failed to load admin data.</p>;
  }

  // Filter orgs by search term (name or slug)
  const filteredOrgs = search
    ? stats.orgs.filter(
        (o) =>
          o.name.toLowerCase().includes(search.toLowerCase()) ||
          o.slug.toLowerCase().includes(search.toLowerCase())
      )
    : stats.orgs;

  return (
    <div className="space-y-6">
      {/* Header with nav links */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Organization Overview
        </h1>
        <button
          onClick={() => router.push("/system-admin/audit")}
          className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 font-medium"
        >
          View Audit Log
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Organizations</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalOrgs}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalUsers}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Projects</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalProjects}</p>
        </div>
      </div>

      {/* Search bar */}
      <div>
        <input
          type="text"
          placeholder="Search organizations by name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {/* Org List Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Organization</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Users</th>
              <th className="text-right px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Projects</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            {filteredOrgs.map((org) => (
              <tr
                key={org.id}
                onClick={() => router.push(`/system-admin/orgs/${org.id}`)}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{org.name}</p>
                    <p className="text-xs text-gray-400">/{org.slug}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${planColor(org.plan)}`}>
                    {org.plan}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor(org.status)}`}>
                    {org.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{org.userCount}</td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{org.projectCount}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {new Date(org.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {filteredOrgs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No organizations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
