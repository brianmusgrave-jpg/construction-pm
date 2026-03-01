"use client";

/**
 * @file src/components/settings/KeeneyModeToggle.tsx
 * @description Toggle for Keeney Mode in user settings.
 * Sprint 21
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mic } from "lucide-react";
import { toast } from "sonner";
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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-50">
          <Mic className="w-5 h-5 text-blue-600" />
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
  );
}
