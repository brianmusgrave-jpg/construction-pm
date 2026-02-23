// Helper for executing mutations with offline fallback.
//
// Usage:
//   import { offlineAction } from "@/lib/offline-action";
//
//   // In a component:
//   const result = await offlineAction("toggleChecklistItem",
//     () => toggleChecklistItem(itemId, checked),
//     { itemId, completed: checked }
//   );
//   if (result.queued) toast.info(t("queuedOffline"));

import { queueMutation } from "@/lib/offline-queue";

interface OfflineActionResult<T> {
  /** Whether the action was queued for later (offline) rather than executed immediately */
  queued: boolean;
  /** The return value from the server action (only present when online) */
  data?: T;
}

/**
 * Execute a server action with offline fallback.
 *
 * @param actionName - Unique name matching a registered offline handler
 * @param execute - Function that calls the actual server action
 * @param payload - Serializable payload to store if offline (for replay later)
 */
export async function offlineAction<T>(
  actionName: string,
  execute: () => Promise<T>,
  payload: Record<string, unknown>
): Promise<OfflineActionResult<T>> {
  // If online, try executing directly
  if (navigator.onLine) {
    try {
      const data = await execute();
      return { queued: false, data };
    } catch (err) {
      // If the error looks like a network failure, queue it
      const msg = err instanceof Error ? err.message : "";
      const isNetworkError =
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("503");

      if (isNetworkError) {
        await queueMutation({ action: actionName, payload });
        return { queued: true };
      }
      // Re-throw non-network errors (validation, auth, etc.)
      throw err;
    }
  }

  // Offline — queue it
  await queueMutation({ action: actionName, payload });
  return { queued: true };
}
