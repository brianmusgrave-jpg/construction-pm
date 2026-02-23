"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { THEME_PRESETS } from "@/lib/themes";
import { updateTheme } from "@/actions/settings";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ThemeSelectorProps {
  currentTheme: string;
}

export function ThemeSelector({ currentTheme }: ThemeSelectorProps) {
  const t = useTranslations("settings");
  const [selected, setSelected] = useState(currentTheme);
  const [saving, setSaving] = useState(false);

  async function handleSelect(themeId: string) {
    setSelected(themeId);
    setSaving(true);
    try {
      await updateTheme(themeId);
    } catch (e) {
      setSelected(currentTheme); // revert
      console.error(e);
    }
    setSaving(false);
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{t("colorTheme")}</h3>
      <p className="text-xs text-gray-500 mb-4">
        {t("themeDescription")}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {THEME_PRESETS.map((preset) => {
          const isActive = selected === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => handleSelect(preset.id)}
              disabled={saving}
              className={cn(
                "relative p-4 rounded-xl border-2 text-left transition-all hover:shadow-md disabled:opacity-70",
                isActive
                  ? "border-gray-900 shadow-sm"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              {isActive && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Color swatches */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-lg"
                  style={{ backgroundColor: preset.colors.primary }}
                />
                <div
                  className="w-6 h-6 rounded-lg"
                  style={{ backgroundColor: preset.colors.primaryDark }}
                />
                <div
                  className="w-6 h-6 rounded-lg"
                  style={{ backgroundColor: preset.colors.primaryLight }}
                />
                <div
                  className="flex-1 h-6 rounded-lg"
                  style={{ backgroundColor: preset.colors.primaryBg }}
                />
              </div>

              <p className="text-sm font-medium text-gray-900">{preset.name}</p>
              <p className="text-xs text-gray-500">{preset.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
