"use client";

/**
 * @file OfflineSyncProvider.tsx
 * @description Context provider that initialises all offline mutation replay handlers
 * exactly once on mount using a useRef(false) guard. Wraps the application tree to
 * guarantee that registerAllOfflineHandlers() is called before any sync attempt is made.
 * Renders children directly with no additional UI output.
 */

import { useEffect, useRef } from "react";
import { registerAllOfflineHandlers } from "@/lib/offline-handlers";

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const registered = useRef(false);

  useEffect(() => {
    if (!registered.current) {
      registerAllOfflineHandlers();
      registered.current = true;
    }
  }, []);

  return <>{children}</>;
}
