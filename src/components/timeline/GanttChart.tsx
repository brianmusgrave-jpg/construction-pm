"use client";

/**
 * @file components/timeline/GanttChart.tsx
 * @description Interactive Gantt chart for visualising and editing phase schedules.
 *
 * Renders a scrollable horizontal timeline showing all phases for a project.
 * Each phase is represented by a `PhaseRow` that includes a draggable blue
 * "estimated" bar and an optional red "worst-case" bar. Milestones render as
 * diamond markers instead of bars.
 *
 * Architecture:
 *   - Timeline range is computed dynamically from all phase dates (2 weeks
 *     before earliest start → 4 weeks after latest end) so the chart always
 *     fits all data without manual configuration.
 *   - Month labels and the "today" green vertical marker are derived from the
 *     same `tlStart`/`totalDays` coordinate system used by `PhaseRow`.
 *   - Date changes from `PhaseRow` are applied optimistically to local state
 *     and then debounced (500 ms) before calling `updatePhaseDates` to avoid
 *     a server round-trip on every pointer move.
 *
 * Server actions: `updatePhaseDates` (phases).
 * i18n namespace: `gantt`.
 */

import { useState, useRef, useCallback } from "react";
import { format, addMonths, startOfMonth, differenceInDays } from "date-fns";
import { ZoomIn, ZoomOut } from "lucide-react";
import { PhaseRow } from "./PhaseRow";
import { updatePhaseDates } from "@/actions/phases";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3];
const BASE_WIDTH_PX = 1000;

interface Phase {
  id: string;
  projectId: string;
  name: string;
  detail?: string | null;
  status: string;
  isMilestone: boolean;
  estStart: Date;
  estEnd: Date;
  worstStart?: Date | null;
  worstEnd?: Date | null;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PhaseAssignment {
  id: string;
  isOwner: boolean;
  staff: { id: string; name: string; company: string | null };
  [key: string]: unknown;
}

type PhaseWithAssignments = Phase & {
  assignments: PhaseAssignment[];
  _count?: { documents: number; photos: number };
};

interface GanttChartProps {
  projectId: string;
  phases: PhaseWithAssignments[];
  planApproval: Date;
}

/**
 * Interactive Gantt chart showing estimated and worst-case date bars for each phase.
 *
 * @param projectId     - Used to build per-phase detail links inside `PhaseRow`.
 * @param phases        - Array of phases with assignments; displayed sorted by `sortOrder`.
 * @param planApproval  - Project plan approval date (available for future milestone marker).
 */
export function GanttChart({ projectId, phases: initialPhases, planApproval }: GanttChartProps) {
  const t = useTranslations("gantt");
  const [phases, setPhases] = useState(initialPhases);
  const [zoomIdx, setZoomIdx] = useState(2); // default = 1x (index 2 in ZOOM_STEPS)
  const containerRef = useRef<HTMLDivElement>(null);

  const zoomLevel = ZOOM_STEPS[zoomIdx];
  const chartWidth = Math.round(BASE_WIDTH_PX * zoomLevel);

  // Calculate timeline range: 2 weeks before first phase to 4 weeks after last
  const allDates = phases.flatMap((p) => [
    p.estStart,
    p.estEnd,
    ...(p.worstStart ? [p.worstStart] : []),
    ...(p.worstEnd ? [p.worstEnd] : []),
  ]);
  const minDate = new Date(
    Math.min(...allDates.map((d) => d.getTime())) - 14 * 86400000
  );
  const maxDate = new Date(
    Math.max(...allDates.map((d) => d.getTime())) + 28 * 86400000
  );
  const tlStart = startOfMonth(minDate);
  const tlEnd = addMonths(startOfMonth(maxDate), 1);
  const totalDays = differenceInDays(tlEnd, tlStart);

  // Generate month labels
  const months: { label: string; offsetPct: number }[] = [];
  let cur = new Date(tlStart);
  while (cur < tlEnd) {
    const offset = differenceInDays(cur, tlStart);
    months.push({
      label: format(cur, "MMM yyyy"),
      offsetPct: (offset / totalDays) * 100,
    });
    cur = addMonths(cur, 1);
  }

  // Today marker
  const today = new Date();
  const todayPct = (differenceInDays(today, tlStart) / totalDays) * 100;

  // Debounced save
const saveTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  const handleDatesChange = useCallback(
    (phaseId: string, updates: {
      estStart?: Date;
      estEnd?: Date;
      worstStart?: Date | null;
      worstEnd?: Date | null;
    }) => {
      // Optimistic update
      setPhases((prev) =>
        prev.map((p) =>
          p.id === phaseId
            ? {
                ...p,
                ...(updates.estStart && { estStart: updates.estStart }),
                ...(updates.estEnd && { estEnd: updates.estEnd }),
                ...(updates.worstStart !== undefined && { worstStart: updates.worstStart }),
                ...(updates.worstEnd !== undefined && { worstEnd: updates.worstEnd }),
              }
            : p
        )
      );

      // Debounce server save
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        const phase = phases.find((p) => p.id === phaseId);
        if (!phase) return;
        const merged = { ...phase, ...updates };
        await updatePhaseDates({
          phaseId,
          estStart: (merged.estStart as Date).toISOString(),
          estEnd: (merged.estEnd as Date).toISOString(),
          worstStart: merged.worstStart
            ? (merged.worstStart as Date).toISOString()
            : null,
          worstEnd: merged.worstEnd
            ? (merged.worstEnd as Date).toISOString()
            : null,
        });
      }, 500);
    },
    [phases]
  );

  return (
    <div className="min-h-0 flex flex-col">
      {/* Legend */}
      <div className="px-3 sm:px-6 py-2 flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-gray-500 bg-white border-b border-gray-100">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-blue-500 rounded-sm" />
          {t("estimated")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-red-400 rounded-sm" />
          {t("worstCase")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-3 bg-green-500 rounded-sm" />
          {t("today")}
        </span>
        <span className="hidden sm:inline text-gray-400">
          {t("dragHelp")}
        </span>
        {/* Zoom controls */}
        <span className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
            disabled={zoomIdx === 0}
            className={cn(
              "p-1 rounded border transition-colors",
              zoomIdx === 0
                ? "border-gray-200 text-gray-300 cursor-not-allowed"
                : "border-gray-300 text-gray-600 hover:bg-gray-100"
            )}
            title={t("zoomOut")}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-medium text-gray-500 min-w-[28px] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            disabled={zoomIdx === ZOOM_STEPS.length - 1}
            className={cn(
              "p-1 rounded border transition-colors",
              zoomIdx === ZOOM_STEPS.length - 1
                ? "border-gray-200 text-gray-300 cursor-not-allowed"
                : "border-gray-300 text-gray-600 hover:bg-gray-100"
            )}
            title={t("zoomIn")}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </span>
      </div>

      {/* Timeline */}
      <div ref={containerRef} className="flex-1 overflow-x-auto overflow-y-auto -webkit-overflow-scrolling-touch">
        <div style={{ minWidth: `${chartWidth}px` }}>
          {/* Month headers */}
          <div className="relative h-8 border-b border-gray-200 bg-gray-50">
            {months.map((m, i) => (
              <div
                key={i}
                className="absolute top-0 text-xs font-medium text-gray-400 uppercase tracking-wider px-2 py-1.5"
                style={{ left: `${m.offsetPct}%` }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Phase rows */}
          <div>
            {phases.map((phase) => (
              <PhaseRow
                key={phase.id}
                phase={phase}
                projectId={projectId}
                tlStart={tlStart}
                totalDays={totalDays}
                todayPct={todayPct}
                onDatesChange={handleDatesChange}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
