"use client";

// Initializes all offline replay handlers on mount.
// Wrap this around the app to ensure handlers are registered before any sync attempt.

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
