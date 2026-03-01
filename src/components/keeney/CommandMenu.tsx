"use client";

/**
 * @file src/components/keeney/CommandMenu.tsx
 * @description Command menu overlay for Keeney Mode.
 * Pre-selects a command type before recording to give the LLM context.
 * Sprint 21
 */

import { useTranslations } from "next-intl";
import { Mic, AlertTriangle, CloudRain, Camera, ClipboardList, RefreshCw, X } from "lucide-react";

interface CommandMenuProps {
  onSelect: (commandType: string) => void;
  onSync: () => void;
  onClose: () => void;
  queueCount: number;
}

const COMMANDS = [
  { type: "voice_memo", icon: Mic, color: "text-blue-600 bg-blue-50" },
  { type: "flag_issue", icon: AlertTriangle, color: "text-red-600 bg-red-50" },
  { type: "weather_delay", icon: CloudRain, color: "text-amber-600 bg-amber-50" },
  { type: "quick_photo", icon: Camera, color: "text-purple-600 bg-purple-50" },
  { type: "daily_summary", icon: ClipboardList, color: "text-green-600 bg-green-50" },
] as const;

export function CommandMenu({ onSelect, onSync, onClose, queueCount }: CommandMenuProps) {
  const t = useTranslations("keeney");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-t-2xl shadow-2xl p-5 pb-8 space-y-3 animate-in slide-in-from-bottom-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            {t("commandMenuTitle")}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
            aria-label={t("close")}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Command buttons */}
        {COMMANDS.map(({ type, icon: Icon, color }) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            <div className={`p-2 rounded-lg ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-800">
                {t(`cmd_${type}`)}
              </p>
              <p className="text-xs text-gray-500">
                {t(`cmd_${type}_desc`)}
              </p>
            </div>
          </button>
        ))}

        {/* Sync button (only if queue has items) */}
        {queueCount > 0 && (
          <button
            onClick={() => { onSync(); onClose(); }}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 active:scale-[0.98] transition-all"
          >
            <div className="p-2 rounded-lg text-amber-600 bg-amber-100">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-amber-800">
                {t("cmd_sync")}
              </p>
              <p className="text-xs text-amber-600">
                {t("memosQueued", { count: queueCount })}
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
