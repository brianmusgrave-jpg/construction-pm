"use client";

/**
 * @file src/components/keeney/KeeneyFAB.tsx
 * @description Floating Action Button for Keeney Mode access.
 * Shows a persistent mic button in the bottom-right corner when Keeney Mode
 * is enabled. Tapping it navigates to the full-screen voice interface.
 * Hidden when already on the /dashboard/keeney page.
 * Sprint 26
 */

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Mic, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface KeeneyFABProps {
  enabled: boolean;
}

export function KeeneyFAB({ enabled }: KeeneyFABProps) {
  const pathname = usePathname();
  const t = useTranslations("keeney");
  const [dismissed, setDismissed] = useState(false);

  // Don't render if disabled, already on keeney page, or user dismissed
  if (!enabled || pathname?.startsWith("/dashboard/keeney") || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 flex items-center gap-2 group">
      {/* Tooltip label — visible on hover (desktop) */}
      <div className="hidden lg:block opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
        {t("voiceMode")}
      </div>

      {/* Dismiss button — small X that appears on hover */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDismissed(true);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-500"
        aria-label={t("close")}
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Main FAB */}
      <Link
        href="/dashboard/keeney"
        className="relative flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-primary,#3b82f6)] text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
        aria-label={t("voiceMode")}
      >
        <Mic className="w-6 h-6" />

        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full bg-[var(--color-primary,#3b82f6)] opacity-20 animate-ping" />
      </Link>
    </div>
  );
}
