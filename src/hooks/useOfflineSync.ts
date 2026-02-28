"use client";

// Offline sync hook — provides online/offline state, queue status,
// and auto-replay of queued mutations when connectivity returns.

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getPendingMutations,
  updateMutationStatus,
  removeMutation,
  getQueueStatus,
  type QueueStatus,
  type QueuedMutation,
} from "@/lib/offline-queue";

const SYNC_INTERVAL_MS = 10_000; // check every 10s when online
const MAX_RETRIES = 5;

// Registry of action handlers — components register how to replay each action type
type ActionHandler = (payload: Record<string, unknown>) => Promise<void>;
const actionHandlers = new Map<string, ActionHandler>();

export function registerOfflineAction(
  action: string,
  handler: ActionHandler
): void {
  actionHandlers.set(action, handler);
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    pending: 0,
    failed: 0,
    isOnline: true,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update online state
  useEffect(() => {
    if (typeof window === "undefined") return;

    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Refresh queue status
  const refreshStatus = useCallback(async () => {
    try {
      const status = await getQueueStatus();
      setQueueStatus(status);
    } catch {
      // IndexedDB not available (SSR or private browsing)
    }
  }, []);

  // Replay one mutation
  const replayMutation = useCallback(
    async (mutation: QueuedMutation): Promise<boolean> => {
      const handler = actionHandlers.get(mutation.action);
      if (!handler) {
        await updateMutationStatus(
          mutation.id!,
          "failed",
          `No handler registered for action: ${mutation.action}`
        );
        return false;
      }

      try {
        await updateMutationStatus(mutation.id!, "syncing");
        await handler(mutation.payload);
        await removeMutation(mutation.id!);
        return true;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown sync error";
        if (mutation.retries + 1 >= MAX_RETRIES) {
          await updateMutationStatus(mutation.id!, "failed", errorMsg);
        } else {
          await updateMutationStatus(mutation.id!, "pending", errorMsg);
        }
        return false;
      }
    },
    []
  );

  // Sync all pending mutations (oldest first)
  const syncAll = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    setIsSyncing(true);
    try {
      const pending = await getPendingMutations();
      // Sort by timestamp ascending (oldest first)
      pending.sort((a, b) => a.timestamp - b.timestamp);

      for (const mutation of pending) {
        if (!navigator.onLine) break; // stop if we go offline mid-sync
        await replayMutation(mutation);
      }
    } finally {
      setIsSyncing(false);
      await refreshStatus();
    }
  }, [isSyncing, replayMutation, refreshStatus]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline) {
      syncAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Periodic sync check while online
  useEffect(() => {
    if (isOnline) {
      syncIntervalRef.current = setInterval(() => {
        refreshStatus();
        if (queueStatus.pending > 0) {
          syncAll();
        }
      }, SYNC_INTERVAL_MS);
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Initial status check
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    isOnline,
    isSyncing,
    queueStatus,
    syncAll,
    refreshStatus,
  };
}
