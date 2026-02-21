"use client";

import { useRef, useCallback } from "react";
import { differenceInDays, addDays, format } from "date-fns";
import { cn, statusColor, statusLabel, fmtShort } from "@/lib/utils";
import type { Phase, PhaseAssignment, Staff } from "@prisma/client";

type PhaseWithAssignments = Phase & {
  assignments: (PhaseAssignment & {
    staff: Pick<Staff, "id" | "name" | "company">;
  })[];
  _count?: { documents: number; photos: number };
};

interface PhaseRowProps {
  phase: PhaseWithAssignments;
  tlStart: Date;
  totalDays: number;
  todayPct: number;
  onDatesChange: (
    phaseId: string,
    updates: {
      estStart?: Date;
      estEnd?: Date;
      worstStart?: Date | null;
      worstEnd?: Date | null;
    }
  ) => void;
}

export function PhaseRow({
  phase,
  tlStart,
  totalDays,
  todayPct,
  onDatesChange,
}: PhaseRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = (date: Date) =>
    (differenceInDays(date, tlStart) / totalDays) * 100;

  const owner = phase.assignments.find((a) => a.isOwner)?.staff;

  function handlePointerDown(
    e: React.PointerEvent,
    barType: "estimated" | "worst",
    mode: "move" | "resize-left" | "resize-right"
  ) {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const track = trackRef.current;
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const startX = e.clientX;
    const pxPerDay = rect.width / totalDays;

    const isEst = barType === "estimated";
    const origStart = new Date(isEst ? phase.estStart : phase.worstStart!);
    const origEnd = new Date(isEst ? phase.estEnd : phase.worstEnd!);

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const daysDelta = Math.round(dx / pxPerDay);

      let newStart: Date;
      let newEnd: Date;

      if (mode === "move") {
        newStart = addDays(origStart, daysDelta);
        newEnd = addDays(origEnd, daysDelta);
      } else if (mode === "resize-left") {
        newStart = addDays(origStart, daysDelta);
        newEnd = new Date(origEnd);
        if (newStart >= newEnd) newStart = addDays(newEnd, -1);
      } else {
        newStart = new Date(origStart);
        newEnd = addDays(origEnd, daysDelta);
        if (newEnd <= newStart) newEnd = addDays(newStart, 1);
      }

      if (isEst) {
        onDatesChange(phase.id, { estStart: newStart, estEnd: newEnd });
      } else {
        onDatesChange(phase.id, { worstStart: newStart, worstEnd: newEnd });
      }
    }

    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  const estLeft = pct(phase.estStart);
  const estWidth = Math.max(pct(phase.estEnd) - estLeft, 0.3);

  const hasWorst = phase.worstStart && phase.worstEnd;
  const worstLeft = hasWorst ? pct(phase.worstStart!) : 0;
  const worstWidth = hasWorst
    ? Math.max(pct(phase.worstEnd!) - worstLeft, 0.3)
    : 0;

  return (
    <div className="flex border-b border-gray-100 hover:bg-gray-50/50 group">
      {/* Label column */}
      <div className="w-52 min-w-52 px-4 py-3 flex flex-col justify-center border-r border-gray-100">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900 truncate">
            {phase.name}
          </span>
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded",
              statusColor(phase.status)
            )}
          >
            {statusLabel(phase.status)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-blue-600">
            {fmtShort(phase.estStart)}
            {!phase.isMilestone && ` – ${fmtShort(phase.estEnd)}`}
          </span>
          {hasWorst && (
            <span className="text-xs text-red-500">
              {fmtShort(phase.worstStart!)} – {fmtShort(phase.worstEnd!)}
            </span>
          )}
        </div>
        {owner && (
          <span className="text-[10px] text-gray-400 mt-0.5 truncate">
            {owner.name}
          </span>
        )}
      </div>

      {/* Bar track */}
      <div ref={trackRef} className="flex-1 relative py-2 min-h-[56px]">
        {/* Today marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-green-500 z-10"
          style={{ left: `${todayPct}%` }}
        />

        {/* Milestone diamond */}
        {phase.isMilestone ? (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rotate-45 z-20"
            style={{ left: `${estLeft}%`, marginLeft: "-6px" }}
          />
        ) : (
          <>
            {/* Estimated bar (blue) */}
            <TimelineBar
              left={estLeft}
              width={estWidth}
              color="blue"
              label={
                estWidth > 4
                  ? `${fmtShort(phase.estStart)} – ${fmtShort(phase.estEnd)}`
                  : ""
              }
              tooltip={`${phase.name} (Estimated): ${fmtShort(phase.estStart)} – ${fmtShort(phase.estEnd)}`}
              onPointerDown={(e, mode) =>
                handlePointerDown(e, "estimated", mode)
              }
            />

            {/* Worst case bar (red) */}
            {hasWorst && (
              <TimelineBar
                left={worstLeft}
                width={worstWidth}
                color="red"
                label={
                  worstWidth > 4
                    ? `${fmtShort(phase.worstStart!)} – ${fmtShort(phase.worstEnd!)}`
                    : ""
                }
                tooltip={`${phase.name} (Worst Case): ${fmtShort(phase.worstStart!)} – ${fmtShort(phase.worstEnd!)}`}
                onPointerDown={(e, mode) =>
                  handlePointerDown(e, "worst", mode)
                }
                isBottom
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TimelineBar({
  left,
  width,
  color,
  label,
  tooltip,
  onPointerDown,
  isBottom,
}: {
  left: number;
  width: number;
  color: "blue" | "red";
  label: string;
  tooltip: string;
  onPointerDown: (
    e: React.PointerEvent,
    mode: "move" | "resize-left" | "resize-right"
  ) => void;
  isBottom?: boolean;
}) {
  const bgColor =
    color === "blue"
      ? "bg-blue-500 hover:bg-blue-600"
      : "bg-red-400 hover:bg-red-500";

  return (
    <div
      className={cn(
        "absolute h-6 rounded cursor-grab active:cursor-grabbing select-none group/bar",
        bgColor,
        isBottom ? "top-[30px]" : "top-[8px]"
      )}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        minWidth: "4px",
      }}
      title={tooltip}
      onPointerDown={(e) => onPointerDown(e, "move")}
    >
      {/* Label text */}
      {label && (
        <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-medium whitespace-nowrap overflow-hidden px-1">
          {label}
        </span>
      )}

      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-white/20 rounded-l"
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDown(e, "resize-left");
        }}
      />

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 bg-white/20 rounded-r"
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDown(e, "resize-right");
        }}
      />
    </div>
  );
}
