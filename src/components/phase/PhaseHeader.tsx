"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn, statusColor, statusLabel } from "@/lib/utils";
import { updatePhaseStatus } from "@/actions/phases";
import { useState } from "react";

const STATUS_TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  PENDING: [{ label: "Start Phase", next: "IN_PROGRESS" }],
  IN_PROGRESS: [{ label: "Request Review", next: "REVIEW_REQUESTED" }],
  REVIEW_REQUESTED: [{ label: "Begin Review", next: "UNDER_REVIEW" }],
  UNDER_REVIEW: [
    { label: "Approve & Complete", next: "COMPLETE" },
    { label: "Send Back", next: "IN_PROGRESS" },
  ],
  COMPLETE: [],
};

interface PhaseHeaderProps {
  phase: {
    id: string;
    name: string;
    status: string;
    progress: number;
    isMilestone: boolean;
  };
  projectId: string;
  projectName: string;
  canEdit: boolean;
  canManage: boolean;
}

export function PhaseHeader({
  phase,
  projectId,
  projectName,
  canEdit,
  canManage,
}: PhaseHeaderProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const transitions = STATUS_TRANSITIONS[phase.status] || [];
  const reviewActions = ["UNDER_REVIEW", "COMPLETE"];

  async function handleTransition(nextStatus: string) {
    setLoading(nextStatus);
    try {
      await updatePhaseStatus(phase.id, nextStatus);
    } catch {
      // Error handling — toast would go here
    }
    setLoading(null);
  }

  return (
    <div className="px-6 py-4 border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto">
        <Link
          href={`/dashboard/projects/${projectId}/timeline`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          {projectName} Timeline
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{phase.name}</h1>
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                statusColor(phase.status)
              )}
            >
              {statusLabel(phase.status)}
            </span>
            {phase.isMilestone && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                Milestone
              </span>
            )}
          </div>

          {canEdit && transitions.length > 0 && (
            <div className="flex gap-2">
              {transitions.map((t) => {
                const needsManage = reviewActions.includes(t.next);
                if (needsManage && !canManage) return null;

                return (
                  <button
                    key={t.next}
                    onClick={() => handleTransition(t.next)}
                    disabled={loading !== null}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50",
                      t.next === "COMPLETE"
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : t.next === "IN_PROGRESS" && phase.status === "UNDER_REVIEW"
                          ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                    )}
                  >
                    {loading === t.next ? "..." : t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
