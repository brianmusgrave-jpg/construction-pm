"use client";

/**
 * @file OfflineIndicator.tsx
 * @description Offline and sync status indicator fixed to the bottom-left of the
 * viewport. Uses the useOfflineSync hook and renders nothing when the app is online with
 * an empty mutation queue. Displays four mutually-exclusive states: an amber offline
 * banner (WifiOff icon), a blue syncing spinner (RefreshCw animate-spin), an indigo
 * pending-sync button that triggers syncAll(), and a red failed-sync banner with a Retry
 * button. i18n: pwa.
 */

import { useOfflineSync } from "@/hooks/useOfflineSync";
import { WifiOff, Wifi, RefreshCw, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

export function OfflineIndicator() {
  const { isOnline, isSyncing, queueStatus, syncAll } = useOfflineSync();
  const t = useTranslations("pwa");

  // Fully online with empty queue — show nothing
  if (isOnline && queueStatus.pending === 0 && queueStatus.failed === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-xs">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <span>{t("offlineBanner")}</span>
        </div>
      )}

      {/* Syncing indicator */}
      {isOnline && isSyncing && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin" />
          <span>
            {t("syncing", { count: queueStatus.pending })}
          </span>
        </div>
      )}

      {/* Pending mutations while online (not yet syncing) */}
      {isOnline && !isSyncing && queueStatus.pending > 0 && (
        <button
          onClick={() => syncAll()}
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-indigo-600 transition-colors"
        >
          <Wifi className="h-4 w-4 flex-shrink-0" />
          <span>
            {t("pendingSync", { count: queueStatus.pending })}
          </span>
        </button>
      )}

      {/* Failed mutations */}
      {queueStatus.failed > 0 && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            {t("failedSync", { count: queueStatus.failed })}
          </span>
          <button
            onClick={() => syncAll()}
            className="ml-auto rounded bg-white/20 px-2 py-0.5 text-xs hover:bg-white/30"
          >
            {t("retry")}
          </button>
        </div>
      )}
    </div>
  );
}
