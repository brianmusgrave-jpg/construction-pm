"use client";

/**
 * @file ColorSchemeSection.tsx
 * @description Custom colour scheme manager for Settings. Provides three modes:
 *   1. Preset — use one of the built-in theme palettes (default)
 *   2. Logo — extract 2-3 palette suggestions from the uploaded logo
 *   3. Custom — manually pick 1-3 colours with a native colour picker
 *
 * Includes live preview swatches and WCAG AA contrast badge.
 * Server actions: saveCustomColors, extractLogoColors, applyLogoPalette, resetToPresetColors.
 * i18n: settings.
 *
 * Sprint 19: Custom Color Scheme feature.
 */

import { useState, useCallback } from "react";
import { Palette, Wand2, RotateCcw, Loader2, Check, AlertTriangle } from "lucide-react";
import {
  saveCustomColors,
  extractLogoColors,
  applyLogoPalette,
  resetToPresetColors,
} from "@/actions/settings";
import { darkenHex, lightenHex, passesWCAG } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ColorSchemeSectionProps {
  colorMode: string;
  colorPrimary: string | null;
  colorSecondary: string | null;
  colorTertiary: string | null;
  hasLogo: boolean;
}

interface PaletteOption {
  label: string;
  primary: string;
  secondary: string;
  tertiary: string;
  wcagPass: boolean;
}

export function ColorSchemeSection({
  colorMode: initialMode,
  colorPrimary: initialPrimary,
  colorSecondary: initialSecondary,
  colorTertiary: initialTertiary,
  hasLogo,
}: ColorSchemeSectionProps) {
  const t = useTranslations("settings");

  // State
  const [mode, setMode] = useState(initialMode);
  const [primary, setPrimary] = useState(initialPrimary || "#2563eb");
  const [secondary, setSecondary] = useState(initialSecondary || "");
  const [tertiary, setTertiary] = useState(initialTertiary || "");
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [palettes, setPalettes] = useState<PaletteOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Computed preview colours
  const previewPrimary = primary;
  const previewDark = secondary || darkenHex(primary, 25);
  const previewLight = lightenHex(primary, 15);
  const previewBg = tertiary || lightenHex(primary, 90);
  const wcagOk = passesWCAG(primary);

  // Extract colours from logo
  const handleExtract = useCallback(async () => {
    setExtracting(true);
    setError(null);
    setPalettes([]);
    try {
      const results = await extractLogoColors();
      setPalettes(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("colorExtractFailed"));
    }
    setExtracting(false);
  }, [t]);

  // Apply a logo-extracted palette
  const handleApplyPalette = useCallback(async (p: PaletteOption) => {
    setSaving(true);
    setError(null);
    try {
      await applyLogoPalette(p.primary, p.secondary, p.tertiary);
      setPrimary(p.primary);
      setSecondary(p.secondary);
      setTertiary(p.tertiary);
      setMode("logo");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("colorSaveFailed"));
    }
    setSaving(false);
  }, [t]);

  // Save custom manual colours
  const handleSaveCustom = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await saveCustomColors(primary, secondary || null, tertiary || null);
      setMode("custom");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("colorSaveFailed"));
    }
    setSaving(false);
  }, [primary, secondary, tertiary, t]);

  // Reset to preset
  const handleReset = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await resetToPresetColors();
      setMode("preset");
      setPrimary("#2563eb");
      setSecondary("");
      setTertiary("");
      setPalettes([]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("colorResetFailed"));
    }
    setSaving(false);
  }, [t]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-900">
          {t("customColorScheme")}
        </h3>
        {mode !== "preset" && (
          <button
            onClick={handleReset}
            disabled={saving}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" />
            {t("colorResetToPreset")}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {t("customColorDescription")}
      </p>

      {/* Error/success messages */}
      {error && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-sm rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-3 flex items-center gap-2 p-2.5 bg-green-50 text-green-700 text-sm rounded-lg">
          <Check className="w-4 h-4 shrink-0" />
          <span>{t("colorSaved")}</span>
        </div>
      )}

      {/* Live preview */}
      <div className="mb-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
        <p className="text-xs font-medium text-gray-600 mb-2">{t("colorPreview")}</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg shadow-sm border border-gray-200" style={{ backgroundColor: previewPrimary }} title="Primary" />
            <div className="w-8 h-8 rounded-lg shadow-sm border border-gray-200" style={{ backgroundColor: previewDark }} title="Dark" />
            <div className="w-8 h-8 rounded-lg shadow-sm border border-gray-200" style={{ backgroundColor: previewLight }} title="Light" />
            <div className="w-12 h-8 rounded-lg shadow-sm border border-gray-200" style={{ backgroundColor: previewBg }} title="Background" />
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium",
              wcagOk ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            )}>
              {wcagOk ? "WCAG AA ✓" : "Low contrast ⚠"}
            </span>
          </div>
        </div>
        {/* Mock UI preview */}
        <div className="mt-3 flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-lg text-white text-xs font-medium" style={{ backgroundColor: previewPrimary }}>
            {t("colorPreviewButton")}
          </button>
          <span className="text-xs font-medium" style={{ color: previewPrimary }}>
            {t("colorPreviewLink")}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: previewBg, color: previewDark }}>
            {t("colorPreviewBadge")}
          </span>
        </div>
      </div>

      {/* Logo extraction section */}
      {hasLogo && (
        <div className="mb-4 p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">{t("colorFromLogo")}</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">{t("colorFromLogoDesc")}</p>

          <button
            onClick={handleExtract}
            disabled={extracting || saving}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            {extracting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t("colorExtracting")}</>
            ) : (
              <><Wand2 className="w-4 h-4" /> {t("colorExtractButton")}</>
            )}
          </button>

          {/* Palette suggestions */}
          {palettes.length > 0 && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {palettes.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleApplyPalette(p)}
                  disabled={saving}
                  className="p-3 rounded-lg border-2 border-gray-200 hover:border-gray-400 text-left transition-all disabled:opacity-50"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: p.primary }} />
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: p.secondary }} />
                    <div className="flex-1 h-5 rounded" style={{ backgroundColor: p.tertiary }} />
                  </div>
                  <p className="text-xs font-medium text-gray-700">{p.label}</p>
                  <span className={cn(
                    "text-[10px]",
                    p.wcagPass ? "text-green-600" : "text-amber-600"
                  )}>
                    {p.wcagPass ? "AA ✓" : "Low contrast"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual colour picker */}
      <div className="p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">{t("colorManual")}</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">{t("colorManualDesc")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Primary */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t("colorPrimaryLabel")} *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-gray-300"
              />
              <input
                type="text"
                value={primary}
                onChange={(e) => {
                  if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setPrimary(e.target.value);
                }}
                placeholder="#2563eb"
                className="flex-1 p-2 border border-gray-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>

          {/* Secondary (optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t("colorSecondaryLabel")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={secondary || darkenHex(primary, 25)}
                onChange={(e) => setSecondary(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-gray-300"
              />
              <input
                type="text"
                value={secondary}
                onChange={(e) => {
                  if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value) || e.target.value === "") setSecondary(e.target.value);
                }}
                placeholder={t("colorAutoGenerated")}
                className="flex-1 p-2 border border-gray-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>

          {/* Tertiary (optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t("colorTertiaryLabel")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={tertiary || lightenHex(primary, 90)}
                onChange={(e) => setTertiary(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-gray-300"
              />
              <input
                type="text"
                value={tertiary}
                onChange={(e) => {
                  if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value) || e.target.value === "") setTertiary(e.target.value);
                }}
                placeholder={t("colorAutoGenerated")}
                className="flex-1 p-2 border border-gray-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveCustom}
          disabled={saving || !primary || primary.length !== 7}
          className="mt-4 px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 flex items-center gap-2"
          style={{ backgroundColor: previewPrimary }}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {t("colorSaving")}</>
          ) : (
            <><Palette className="w-4 h-4" /> {t("colorApply")}</>
          )}
        </button>
      </div>
    </div>
  );
}
