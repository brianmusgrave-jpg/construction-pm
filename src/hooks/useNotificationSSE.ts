"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Connects to the SSE endpoint and calls onCount whenever the unread
 * notification count changes.  Falls back to a 30-second polling interval
 * if EventSource is unavailable (e.g. Safari < 15 or HTTP/1.1 proxies).
 */
export function useNotificationSSE(onCount: (count: number) => void) {
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
      // Fallback: poll every 30s
      const poll = async () => {
        try {
          const res = await fetch("/api/notifications/unread-count");
          if (res.ok) {
            const { count } = (await res.json()) as { count: number };
            handleCount(count);
          }
        } catch {
          // ignore
        }
      };
      poll();
      const id = setInterval(poll, 30_000);
      return () => clearInterval(id);
    }

    const es = new EventSource("/api/sse/notifications");

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { type: string; count: number };
        if (data.type === "unread_count") handleCount(data.count);
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      // Browser will auto-reconnect; no action needed
    };

    return () => es.close();
  }, [handleCount]);
}
