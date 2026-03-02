"use client";

/**
 * @file src/components/settings/KeeneyModeToggle.tsx
 * @description Toggle for Keeney Mode in user settings.
 * Sprint 21 — improved UX with "Try it now" link in Sprint 26.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mic, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { toggleKeeneyMode } from "@/actions/keeney";

interface KeeneyModeToggleProps {
  enabled: boolean;
}

export function KeeneyModeToggle({ enabled: initialEnabled }: KeeneyModeToggleProps) {
  const t = useTranslations("settings");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    setSaving(true);
    try {
      const result = await toggleKeeneyMode(!enabled);
      if (result.success) {
        setEnabled(!enabled);
        toast.success(
          !enabled ? t("keeneyEnabled") : t("keeneyDisabled")
        );
      }
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${enabled ? "bg-blue-100" : "bg-blue-50"}`}>
            <Mic className={`w-5 h-5 ${enabled ? "text-blue-700" : "text-blue-600"}`} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              {t("keeneyModeTitle")}
            </h3>
            <p className="text-xs text-gray-500">
              {t("keeneyModeDescription")}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
            enabled ? "bg-blue-600" : "bg-gray-200"
          }`}
          role="switch"
          aria-checked={enabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* "Try it now" link — shown when enabled */}
      {enabled && (
        <Link
          href="/dashboard/keeney"
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors group"
        >
          <Mic className="w-4 h-4" />
          {t("keeneyTryNow")}
          <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}
    </div>
  );
}
