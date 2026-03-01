"use client";

import { useEffect, useState } from "react";
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

export default function SystemAdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Organization Overview
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Organizations</p>
          <p className="text-3xl font-bold">{stats.totalOrgs}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Users</p>
          <p className="text-3xl font-bold">{stats.totalUsers}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Projects</p>
          <p className="text-3xl font-bold">{stats.totalProjects}</p>
        </div>
      </div>

      {/* Org List Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Organization</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Users</th>
              <th className="text-right px-4 py-3 font-medium">Projects</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            {stats.orgs.map((org) => (
              <tr key={org.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{org.name}</p>
                    <p className="text-xs text-gray-400">/{org.slug}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      org.plan === "ENTERPRISE"
                        ? "bg-purple-100 text-purple-800"
                        : org.plan === "PRO"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {org.plan}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      org.status === "ACTIVE"
                        ? "bg-green-100 text-green-800"
                        : org.status === "TRIAL"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {org.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{org.userCount}</td>
                <td className="px-4 py-3 text-right">{org.projectCount}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(org.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
