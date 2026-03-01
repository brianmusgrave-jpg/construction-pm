"use client";

/**
 * @file src/components/keeney/ConfirmationCard.tsx
 * @description Confirmation card shown after voice transcription + intent parsing.
 * Displays what will be logged, which project, and who gets notified.
 * Sprint 21
 */

import { useTranslations } from "next-intl";
import { Check, X, Edit2, AlertTriangle, MapPin } from "lucide-react";

interface Project {
  id: string;
  name: string;
  address: string | null;
}

interface ParsedIntent {
  project: { id: string; name: string; confidence: number } | null;
  actionType: string;
  summary: string;
  details: string;
  scheduleImpact: string | null;
  notify: string[];
  needsClarification: string | null;
  language: string;
}

interface ConfirmationCardProps {
  intent: ParsedIntent;
  transcript: string;
  projects: Project[];
  onConfirm: () => void;
  onCancel: () => void;
  onSelectProject: (projectId: string) => void;
}

const ACTION_ICONS: Record<string, string> = {
  daily_log: "📋",
  weather_delay: "⛈️",
  punch_list: "⚠️",
  photo_note: "📷",
  schedule_update: "📅",
  general_note: "📝",
};

export function ConfirmationCard({
  intent,
  transcript,
  projects,
  onConfirm,
  onCancel,
  onSelectProject,
}: ConfirmationCardProps) {
  const t = useTranslations("keeney");

  const icon = ACTION_ICONS[intent.actionType] || "📝";

  // If clarification needed — show project picker
  if (intent.needsClarification) {
    return (
      <div className="w-full bg-white rounded-2xl shadow-lg border p-5 space-y-4 animate-in slide-in-from-bottom-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-gray-700">{intent.needsClarification}</p>
        </div>

        <div className="space-y-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectProject(p.id)}
              className="w-full text-left p-3 rounded-lg border hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              <p className="font-medium text-sm">{p.name}</p>
              {p.address && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {p.address}
                </p>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          {t("cancel")}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-2xl shadow-lg border p-5 space-y-4 animate-in slide-in-from-bottom-4">
      {/* Action type badge */}
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {intent.actionType.replace(/_/g, " ")}
        </span>
      </div>

      {/* Project */}
      {intent.project && (
        <div className="bg-blue-50 rounded-lg px-3 py-2">
          <p className="text-sm font-semibold text-blue-800">
            {intent.project.name}
          </p>
        </div>
      )}

      {/* Summary */}
      <p className="text-sm text-gray-800 font-medium">{intent.summary}</p>

      {/* Details (if different from summary) */}
      {intent.details && intent.details !== intent.summary && (
        <p className="text-xs text-gray-500">{intent.details}</p>
      )}

      {/* Schedule impact */}
      {intent.scheduleImpact && (
        <div className="flex items-start gap-2 bg-amber-50 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">{intent.scheduleImpact}</p>
        </div>
      )}

      {/* Notifications */}
      {intent.notify.length > 0 && (
        <p className="text-xs text-gray-400">
          {t("willNotify")}: {intent.notify.join(", ")}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onConfirm}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 active:scale-95 transition-all"
        >
          <Check className="w-4 h-4" />
          {t("confirm")}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-200 active:scale-95 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
