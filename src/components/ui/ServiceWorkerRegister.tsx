"use client";

/**
 * @file ServiceWorkerRegister.tsx
 * @description Effect-only component that registers the /sw.js service worker on mount
 * when the serviceWorker API is available in the browser. Registration failures are
 * logged silently to the console. Returns null — no UI is rendered.
 */

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.log("SW registration failed:", err);
      });
    }
  }, []);

  return null;
}
