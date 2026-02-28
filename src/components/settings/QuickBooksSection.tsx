"use client";

/**
 * @file components/settings/QuickBooksSection.tsx
 * @description Settings panel for the QuickBooks Online integration.
 *
 * Shows either a "connect" CTA (when no connection exists) or a connected
 * state with sync controls, per-entity toggles, and sync history.
 *
 * Connected state features:
 *   - Company info card with disconnect button (requires confirm dialog).
 *   - Last-sync status row with a "Sync Now" button (triggers full sync).
 *   - Four per-entity toggles (invoices, expenses, vendors, customers) with
 *     optimistic UI — toggle reverts on server error.
 *   - Master "Auto Sync" toggle for scheduled background syncs.
 *   - Sync history table showing the last 5 log entries with status icons.
 *
 * ⚠️  NOTE: `triggerQuickBooksSync` is currently a stub on the server side —
 * it fetches QB records but does NOT write to the application database yet.
 * After a successful sync call the component reloads the page to reflect
 * updated connection metadata.
 *
 * Status icons: CheckCircle2 (success), XCircle (error), AlertTriangle
 *   (partial), Loader2 (started/in-progress), Clock (unknown/pending).
 *
 * Server actions: `getQuickBooksAuthUrl`, `disconnectQuickBooks`,
 *   `triggerQuickBooksSync`, `updateQuickBooksSyncSettings` (quickbooks).
 * i18n namespace: `quickbooks`.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  RefreshCw,
  Unplug,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ToggleLeft,
  ToggleRight,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  getQuickBooksAuthUrl,
  disconnectQuickBooks,
  triggerQuickBooksSync,
  updateQuickBooksSyncSettings,
} from "@/actions/quickbooks";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

interface SyncLog {
  id: string;
  syncType: string;
  status: string;
  itemsSynced: number;
  itemsFailed: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface QuickBooksConnection {
  id: string;
  companyId: string;
  companyName: string | null;
  syncEnabled: boolean;
  syncInvoices: boolean;
  syncExpenses: boolean;
  syncVendors: boolean;
  syncCustomers: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  tokenExpiry: string;
  createdAt: string;
}

export function QuickBooksSection({
  connection,
  syncLogs,
}: {
  connection: QuickBooksConnection | null;
  syncLogs: SyncLog[];
}) {
  const confirm = useConfirmDialog();
  const t = useTranslations("quickbooks");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [localConnection, setLocalConnection] = useState(connection);
  const [localLogs, setLocalLogs] = useState(syncLogs);

  async function handleConnect() {
    setConnecting(true);
    try {
      const result = await getQuickBooksAuthUrl();
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error(result.error || t("connectError"));
      }
    } catch {
      toast.error(t("connectError"));
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!await confirm(t("disconnectConfirm"), { danger: true })) return;
    setDisconnecting(true);
    try {
      const result = await disconnectQuickBooks();
      if (result.success) {
        toast.success(t("disconnected"));
        setLocalConnection(null);
        setLocalLogs([]);
      } else {
        toast.error(result.error || t("disconnectError"));
      }
    } catch {
      toast.error(t("disconnectError"));
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSync(syncType: "full" | "invoices" | "expenses" | "vendors" | "customers" = "full") {
    setSyncing(true);
    try {
      const result = await triggerQuickBooksSync(syncType);
      if (result.success) {
        toast.success(t("syncStarted"));
        // Refresh the page to get updated data
        window.location.reload();
      } else {
        toast.error(result.error || t("syncError"));
      }
    } catch {
      toast.error(t("syncError"));
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggle(
    field: "syncEnabled" | "syncInvoices" | "syncExpenses" | "syncVendors" | "syncCustomers"
  ) {
    if (!localConnection) return;
    const newVal = !localConnection[field];
    setLocalConnection({ ...localConnection, [field]: newVal });
    try {
      await updateQuickBooksSyncSettings({ [field]: newVal });
      toast.success(t("settingsSaved"));
    } catch {
      setLocalConnection({ ...localConnection, [field]: !newVal });
      toast.error(t("settingsError"));
    }
  }

  function statusIcon(status: string | null) {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "partial":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "started":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t("title")}</h2>
        </div>
        {localConnection && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            {t("connected")}
          </span>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-4">{t("description")}</p>

      {!localConnection ? (
        /* ── Not Connected ── */
        <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
          <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-900 mb-1">{t("notConnected")}</h3>
          <p className="text-xs text-gray-500 mb-4">{t("notConnectedDesc")}</p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            {t("connectButton")}
          </button>
        </div>
      ) : (
        /* ── Connected ── */
        <div className="space-y-4">
          {/* Company Info */}
          <div className="flex items-center justify-between rounded-lg bg-green-50 p-3">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {localConnection.companyName || t("unknownCompany")}
              </p>
              <p className="text-xs text-gray-500">
                {t("companyId")}: {localConnection.companyId}
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {disconnecting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Unplug className="h-3 w-3" />
              )}
              {t("disconnect")}
            </button>
          </div>

          {/* Last Sync Status */}
          <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
            <div className="flex items-center gap-2">
              {statusIcon(localConnection.lastSyncStatus)}
              <div>
                <p className="text-sm text-gray-700">
                  {localConnection.lastSyncAt
                    ? `${t("lastSync")}: ${formatDate(localConnection.lastSyncAt)}`
                    : t("neverSynced")}
                </p>
                {localConnection.lastSyncMessage && (
                  <p className="text-xs text-gray-500">{localConnection.lastSyncMessage}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => handleSync("full")}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {syncing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {t("syncNow")}
            </button>
          </div>

          {/* Sync Toggles */}
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { key: "syncInvoices", label: t("invoices") },
                { key: "syncExpenses", label: t("expenses") },
                { key: "syncVendors", label: t("vendors") },
                { key: "syncCustomers", label: t("customers") },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleToggle(key)}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm text-gray-700">{label}</span>
                {localConnection[key] ? (
                  <ToggleRight className="h-5 w-5 text-indigo-600" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-gray-300" />
                )}
              </button>
            ))}
          </div>

          {/* Master Sync Toggle */}
          <button
            onClick={() => handleToggle("syncEnabled")}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{t("autoSync")}</p>
              <p className="text-xs text-gray-500">{t("autoSyncDesc")}</p>
            </div>
            {localConnection.syncEnabled ? (
              <ToggleRight className="h-6 w-6 text-indigo-600" />
            ) : (
              <ToggleLeft className="h-6 w-6 text-gray-300" />
            )}
          </button>

          {/* Sync History */}
          {localLogs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">{t("syncHistory")}</h3>
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
                {localLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      {statusIcon(log.status)}
                      <span className="capitalize text-gray-700">{log.syncType}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-500">
                      <span>
                        {log.itemsSynced} {t("synced")}
                        {log.itemsFailed > 0 && (
                          <span className="text-red-500">
                            {" / "}{log.itemsFailed} {t("failed")}
                          </span>
                        )}
                      </span>
                      <span>{formatDate(log.startedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
