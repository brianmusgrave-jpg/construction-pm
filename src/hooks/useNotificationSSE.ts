"use client";

/**
 * @file hooks/useNotificationSSE.ts
 * @description React hook for real-time unread notification count updates.
 *
 * Connects to `/api/sse/notifications` using the browser's EventSource API
 * (Server-Sent Events). The SSE endpoint pushes `{ type: "unread_count", count: N }`
 * messages whenever the user's unread count changes.
 *
 * Degradation strategy:
 *   - When EventSource is available (most modern browsers), a persistent SSE
 *     connection is established. The browser handles automatic reconnection on
 *     transient failures.
 *   - When EventSource is unavailable (Safari < 15, some HTTP/1.1 proxies,
 *     or environments where SSE is blocked), the hook falls back to polling
 *     `/api/notifications/unread-count` every 30 seconds.
 *
 * Deduplication: A `lastCount` ref prevents redundant `onCount` calls when
 * the same count is received twice (e.g. on SSE reconnect).
 *
 * Usage:
 *   useNotificationSSE((count) => setUnreadCount(count));
 */

import { useEffect, useRef, useCallback } from "react";

/**
 * Subscribe to real-time unread notification count updates via SSE.
 *
 * The `onCount` callback fires immediately on first connect (with the
 * current count) and again whenever the count changes. It is NOT called
 * if the incoming count is identical to the last received value.
 *
 * The hook cleans up automatically on unmount: the SSE connection is closed
 * or the polling interval is cleared.
 *
 * @param onCount - Callback invoked with the new unread count on each change.
 *
 * @example
 *   function NotificationBell() {
 *     const [count, setCount] = useState(0);
 *     useNotificationSSE(setCount);
 *     return <span>{count}</span>;
 *   }
 */
export function useNotificationSSE(onCount: (count: number) => void) {
  // Track last seen count to avoid redundant re-renders on SSE reconnects.
  const lastCount = useRef<number | null>(null);

  const handleCount = useCallback(
    (count: number) => {
      if (count !== lastCount.current) {
        lastCount.current = count;
        onCount(count);
      }
    },
    [onCount]
  );

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      // ── Polling fallback ──
      // Used when SSE is not available in the browser environment.
      const poll = async () => {
        try {
          const res = await fetch("/api/notifications/unread-count");
          if (res.ok) {
            const { count } = (await res.json()) as { count: number };
            handleCount(count);
          }
        } catch {
          // Network errors are silently swallowed — the next poll will retry.
        }
      };
      poll(); // Immediate first poll, then on interval
      const id = setInterval(poll, 30_000);
      return () => clearInterval(id);
    }

    // ── SSE primary path ──
    const es = new EventSource("/api/sse/notifications");

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { type: string; count: number };
        // Filter to only unread_count events; ignore other event types.
        if (data.type === "unread_count") handleCount(data.count);
      } catch {
        // Malformed JSON from the SSE stream — ignore and wait for next event.
      }
    };

    es.onerror = () => {
      // EventSource automatically reconnects after errors; no manual action needed.
    };

    // Close the SSE connection when the component unmounts.
    return () => es.close();
  }, [handleCount]);
}
