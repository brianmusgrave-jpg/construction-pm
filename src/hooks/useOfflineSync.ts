"use client";

/**
 * @file hooks/useOfflineSync.ts
 * @description React hook for offline-first mutation queue management.
 *
 * Provides online/offline detection, queue status monitoring, and automatic
 * replay of mutations that were queued while the user was offline.
 *
 * Architecture:
 *   - Mutations captured while offline are stored in IndexedDB via
 *     `@/lib/offline-queue`. Each entry includes the action name, payload,
 *     timestamp, retry count, and current status.
 *   - `registerOfflineAction(action, handler)` registers a replay handler for
 *     a given action string. Components call this at mount time so the hook
 *     knows how to re-execute each queued operation.
 *   - `useOfflineSync` monitors online/offline events. When connectivity is
 *     restored (or on a 10-second interval while online), it drains the queue
 *     oldest-first, calling each mutation's registered handler.
 *   - Failed mutations are retried up to `MAX_RETRIES` times before being
 *     marked as permanently "failed".
 *
 * Retry policy:
 *   - If `retries + 1 < MAX_RETRIES` (5): mutation stays "pending" with the
 *     error message stored for debugging.
 *   - If `retries + 1 >= MAX_RETRIES`: mutation is marked "failed" and will
 *     not be retried automatically. The user must resolve it manually.
 *
 * IndexedDB unavailability (SSR, private browsing): errors from queue reads
 * are silently swallowed so the hook degrades gracefully without crashing.
 *
 * Module-level state: `actionHandlers` is a Map held at module scope so that
 * handlers registered by different components persist across re-renders without
 * requiring a React context or global store.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getPendingMutations,
  updateMutationStatus,
  removeMutation,
  getQueueStatus,
  type QueueStatus,
  type QueuedMutation,
} from "@/lib/offline-queue";

/** How often (ms) to poll the queue for pending mutations while online. */
const SYNC_INTERVAL_MS = 10_000;

/** Maximum number of replay attempts before a mutation is marked "failed". */
const MAX_RETRIES = 5;

// ── Action Handler Registry ──

/** Signature for an offline action replay handler. */
type ActionHandler = (payload: Record<string, unknown>) => Promise<void>;

/**
 * Module-level registry mapping action strings to their replay handlers.
 * Persists across component re-renders since it is outside the React tree.
 */
const actionHandlers = new Map<string, ActionHandler>();

/**
 * Register a handler function for a given offline action type.
 *
 * Call this at component mount time (or in a module-level initialiser) for
 * each action that can be queued offline. If a queued mutation has no
 * registered handler, it will be marked "failed" immediately on sync.
 *
 * @param action  - The action string that identifies this mutation type.
 *                  Must match the value used when enqueueing the mutation.
 * @param handler - Async function that replays the mutation server-side.
 *
 * @example
 *   registerOfflineAction("createDailyLog", async (payload) => {
 *     await createDailyLog(payload as DailyLogInput);
 *   });
 */
export function registerOfflineAction(
  action: string,
  handler: ActionHandler
): void {
  actionHandlers.set(action, handler);
}

// ── Hook ──

/**
 * Monitor online/offline state and drain the offline mutation queue.
 *
 * Behaviours:
 *   - Tracks `navigator.onLine` via `"online"` and `"offline"` window events.
 *   - Drains all "pending" mutations from IndexedDB when `isOnline` becomes true.
 *   - While online, polls every `SYNC_INTERVAL_MS` (10 s) and triggers a drain
 *     if `queueStatus.pending > 0`.
 *   - Provides `syncAll` for manual / imperative sync triggers.
 *
 * SSR safety: the `typeof window === "undefined"` guard in the online/offline
 * effect prevents errors during Next.js server-side rendering.
 *
 * @returns
 *   - `isOnline`     — current connectivity state
 *   - `isSyncing`    — true while a drain pass is in progress
 *   - `queueStatus`  — `{ pending, failed, isOnline }` from the queue
 *   - `syncAll`      — manually trigger a full queue drain
 *   - `refreshStatus` — re-read `queueStatus` from IndexedDB
 */
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    pending: 0,
    failed: 0,
    isOnline: true,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Online/Offline detection ──
  useEffect(() => {
    if (typeof window === "undefined") return; // SSR guard

    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine); // Seed from current state on mount
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ── Queue status ──

  /** Read the current pending/failed counts from IndexedDB. */
  const refreshStatus = useCallback(async () => {
    try {
      const status = await getQueueStatus();
      setQueueStatus(status);
    } catch {
      // IndexedDB unavailable (SSR or private browsing) — silently degrade.
    }
  }, []);

  // ── Individual mutation replay ──

  /**
   * Attempt to replay a single queued mutation.
   *
   * Status flow:
   *   pending → syncing → (success) removed from queue
   *                     → (failure, retries < MAX_RETRIES) back to pending
   *                     → (failure, retries >= MAX_RETRIES) marked failed
   *
   * @returns true if the mutation was successfully replayed; false otherwise.
   */
  const replayMutation = useCallback(
    async (mutation: QueuedMutation): Promise<boolean> => {
      const handler = actionHandlers.get(mutation.action);
      if (!handler) {
        // No handler registered — mark failed immediately so it doesn't block the queue.
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
        await removeMutation(mutation.id!); // Clean up on success
        return true;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown sync error";
        // Exhausted retries → permanently failed; otherwise keep as pending.
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

  // ── Queue drain ──

  /**
   * Process all pending mutations in chronological order (oldest-first FIFO).
   *
   * Guards: no-op if already syncing or currently offline. Aborts mid-drain
   * if connectivity drops so mutations are not lost.
   *
   * Calls `refreshStatus` after the drain pass completes (success or error).
   */
  const syncAll = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    setIsSyncing(true);
    try {
      const pending = await getPendingMutations();
      // Oldest-first ensures causally ordered replay (e.g. create before update).
      pending.sort((a, b) => a.timestamp - b.timestamp);

      for (const mutation of pending) {
        if (!navigator.onLine) break; // Abort if we lose connection mid-drain
        await replayMutation(mutation);
      }
    } finally {
      setIsSyncing(false);
      await refreshStatus();
    }
  }, [isSyncing, replayMutation, refreshStatus]);

  // ── Auto-sync on reconnect ──
  useEffect(() => {
    if (isOnline) {
      syncAll(); // Immediately drain when connection is restored
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // ── Periodic background check while online ──
  useEffect(() => {
    if (isOnline) {
      syncIntervalRef.current = setInterval(() => {
        refreshStatus();
        if (queueStatus.pending > 0) {
          syncAll(); // Only drain if there are pending items
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

  // ── Initial status read ──
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
