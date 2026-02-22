"use client";

import { fmtLong, daysBetween } from "@/lib/utils";
import { Calendar, Clock } from "lucide-react";

interface PhaseInfoProps {
  phase: {
    id: string;
    name: string;
    detail: string | null;
    progress: number;
    estStart: Date;
    estEnd: Date;
    worstStart: Date | null;
    worstEnd: Date | null;
    actualStart: Date | null;
    actualEnd: Date | null;
  };
  canEdit: boolean;
}

export function PhaseInfoSection({ phase }: PhaseInfoProps) {
  const estDays = daysBetween(phase.estStart, phase.estEnd);
  const worstDays =
    phase.worstStart && phase.worstEnd
      ? daysBetween(phase.worstStart, phase.worstEnd)
      : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
        Phase Details
      </h2>

      {phase.detail && (
        <p className="text-sm text-gray-600 mb-4">{phase.detail}</p>
      )}

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{phase.progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${phase.progress}%` }}
          />
        </div>
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
            <Calendar className="w-4 h-4" />
            Estimated Timeline
          </div>
          <div className="text-sm text-gray-600 pl-6">
            <p>{fmtLong(phase.estStart)} — {fmtLong(phase.estEnd)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {estDays} day{estDays !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {phase.worstStart && phase.worstEnd && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-red-600">
              <Clock className="w-4 h-4" />
              Worst Case
            </div>
            <div className="text-sm text-gray-600 pl-6">
              <p>{fmtLong(phase.worstStart)} — {fmtLong(phase.worstEnd)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {worstDays} day{worstDays !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        )}

        {phase.actualStart && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-green-700">
              <Calendar className="w-4 h-4" />
              Actual
            </div>
            <div className="text-sm text-gray-600 pl-6">
              <p>
                Started {fmtLong(phase.actualStart)}
                {phase.actualEnd && ` — Completed ${fmtLong(phase.actualEnd)}`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
