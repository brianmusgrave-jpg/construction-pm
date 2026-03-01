"use client";

/**
 * @file system-admin/components/ImpersonationBanner.tsx
 * @description Persistent warning banner shown when a SYSTEM_ADMIN is viewing
 * the app as another user via impersonation.
 *
 * The banner is fixed to the top of the viewport with a high z-index so it
 * always remains visible, reminding the admin they are in impersonation mode.
 * Clicking "Exit" hits the impersonation API with ?exit=1 to clear the cookie
 * and redirect back to /system-admin.
 */

import { useEffect, useState } from "react";

interface ImpersonationData {
  targetUserName: string;
  targetUserRole: string;
}

export default function ImpersonationBanner() {
  const [data, setData] = useState<ImpersonationData | null>(null);

  useEffect(() => {
    // Read the impersonation cookie from document.cookie (client-side)
    // The cookie is httpOnly so this won't work — instead we'll check a
    // non-httpOnly signal cookie or use a server component approach.
    // For now, we use a separate lightweight API to check impersonation status.
    checkImpersonation();
  }, []);

  async function checkImpersonation() {
    try {
      const res = await fetch("/api/impersonate/status");
      if (res.ok) {
        const json = await res.json();
        if (json.impersonating) {
          setData({
            targetUserName: json.targetUserName,
            targetUserRole: json.targetUserRole,
          });
        }
      }
    } catch {
      // Not impersonating or API not available — banner stays hidden
    }
  }

  if (!data) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-black px-4 py-2 flex items-center justify-between text-sm font-medium shadow-lg">
      <span>
        ⚠️ Viewing as <strong>{data.targetUserName}</strong> ({data.targetUserRole})
      </span>
      <a
        href="/api/impersonate?exit=1"
        className="bg-black text-amber-500 px-3 py-1 rounded text-xs font-bold hover:bg-gray-800 transition-colors"
      >
        Exit Impersonation
      </a>
    </div>
  );
}
