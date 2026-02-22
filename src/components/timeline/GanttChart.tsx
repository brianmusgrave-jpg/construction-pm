"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { format, addMonths, startOfMonth, differenceInDays } from "date-fns";
import { PhaseRow } from "./PhaseRow";
import { updatePhaseDates } from "@/actions/phases";
import { cn } from "@/lib/utils";

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
  createdAt: Date;
  updatedAt: Date;
}

interface Staff {
  id: string;
  name: string;
  company?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PhaseAssignment {
  id: string;
  phaseId: string;
  staffId: string;
  isOwner: boolean;
  createdAt: Date;
  updatedAt: Date;
  staff: Pick<Staff, "id" | "name" | "company">;
}

type PhaseWithAssignments = Phase & {
  assignments: (PhaseAssignment & {
    staff: Pick<Staff, "id" | "name" | "company">;
  })[];
  _count?: { documents: number; photos: number };
};

interface GanttChartProps {
  projectId: string;
  phases: PhaseWithAssignments[];
  planApproval: Date;
}

export function GanttChart({ projectId, phases: initialPhases, planApproval }: GanttChartProps) {
  const [phases, setPhases] = useState(initialPhases);
  const containerRef = useRef<HTMLDivElement>(null);

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
      <div className="px-6 py-2 flex items-center gap-6 text-xs text-gray-500 bg-white border-b border-gray-100">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-blue-500 rounded-sm" />
          Estimated
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-red-400 rounded-sm" />
          Worst Case
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-3 bg-green-500 rounded-sm" />
          Today
        </span>
        <span className="ml-auto text-gray-400">
          Drag bars to slide &bull; Drag edges to resize
        </span>
      </div>

      {/* Timeline */}
      <div ref={containerRef} className="flex-1 overflow-x-auto overflow-y-auto">
        <div style={{ minWidth: "1000px" }}>
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
