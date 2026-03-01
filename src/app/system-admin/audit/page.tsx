"use client";

/**
 * @file system-admin/audit/page.tsx
 * @description System Admin audit log viewer. Shows all God-Mode actions taken
 * by any SYSTEM_ADMIN, with cursor-based pagination for loading older entries.
 *
 * Each entry shows: timestamp, admin who acted, action type, target org/user, and detail.
 * Action types are color-coded for quick scanning.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminAuditLog } from "@/actions/system-admin";

interface AuditEntry {
  id: string;
  action: string;
  detail: string | null;
  adminName: string;
  orgName: string | null;
  orgSlug: string | null;
  targetUserId: string | null;
  createdAt: string;
}

/** Color coding for different admin action types */
function actionColor(action: string) {
  if (action.startsWith("impersonate")) return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  if (action.startsWith("change_plan") || action.startsWith("change_status")) return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
  if (action.startsWith("toggle_feature")) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  if (action.startsWith("reset") || action.startsWith("clear")) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  if (action.startsWith("resend") || action.startsWith("extend")) return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
}

export default function AuditLogPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries(cursor?: string) {
    try {
      const result = await getAdminAuditLog(50, cursor);
      if (cursor) {
        // Append to existing entries
        setEntries((prev) => [...prev, ...result.entries]);
      } else {
        setEntries(result.entries);
      }
      setNextCursor(result.nextCursor);
    } catch (err: any) {
      console.error("Failed to load audit log:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    await loadEntries(nextCursor);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/system-admin")}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Audit Log</h1>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-400">No admin actions logged yet.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Admin</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Action</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Org</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {entry.adminName}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${actionColor(entry.action)}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {entry.orgName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                    {entry.detail ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Load More */}
          {nextCursor && (
            <div className="px-4 py-3 text-center border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 font-medium disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
