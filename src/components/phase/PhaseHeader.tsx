"use client";

import Link from "next/link";
import { cn, statusColor } from "@/lib/utils";
import { updatePhaseStatus } from "@/actions/phases";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface StatusTransition {
  labelKey: string;
  next: string;
}

const STATUS_TRANSITION_KEYS: Record<string, StatusTransition[]> = {
  PENDING: [{ labelKey: "startPhase", next: "IN_PROGRESS" }],
  IN_PROGRESS: [{ labelKey: "requestReview", next: "REVIEW_REQUESTED" }],
  REVIEW_REQUESTED: [{ labelKey: "beginReview", next: "UNDER_REVIEW" }],
  UNDER_REVIEW: [
    { labelKey: "approveComplete", next: "COMPLETE" },
    { labelKey: "sendBack", next: "IN_PROGRESS" },
  ],
  COMPLETE: [],
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  PENDING: "pending",
  IN_PROGRESS: "inProgress",
  REVIEW_REQUESTED: "reviewRequested",
  UNDER_REVIEW: "underReview",
  COMPLETE: "complete",
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
  const t = useTranslations("phases");
  const ts = useTranslations("status");
  const [loading, setLoading] = useState<string | null>(null);

  const transitions = STATUS_TRANSITION_KEYS[phase.status] || [];
  const reviewActions = ["UNDER_REVIEW", "COMPLETE"];

  async function handleTransition(nextStatus: string) {
    setLoading(nextStatus);
    try {
      await updatePhaseStatus(phase.id, nextStatus);
    } catch {
      // Error handling
    }
    setLoading(null);
  }

  return (
    <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 mb-3 overflow-x-auto">
          <Link
            href={`/dashboard/projects/${projectId}`}
            className="hover:text-gray-700 shrink-0"
          >
            {projectName}
          </Link>
          <span className="shrink-0">/</span>
          <Link
            href={`/dashboard/projects/${projectId}/timeline`}
            className="hover:text-gray-700 shrink-0"
          >
            {t("timeline")}
          </Link>
          <span className="shrink-0">/</span>
          <span className="text-gray-400 truncate">{phase.name}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">{phase.name}</h1>
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                statusColor(phase.status)
              )}
            >
              {ts(STATUS_LABEL_KEYS[phase.status] || "pending")}
            </span>
            {phase.isMilestone && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                {t("milestone")}
              </span>
            )}
          </div>

          {canEdit && transitions.length > 0 && (
            <div className="flex gap-2">
              {transitions.map((tr) => {
                const needsManage = reviewActions.includes(tr.next);
                if (needsManage && !canManage) return null;

                return (
                  <button
                    key={tr.next}
                    onClick={() => handleTransition(tr.next)}
                    disabled={loading !== null}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50",
                      tr.next === "COMPLETE"
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : tr.next === "IN_PROGRESS" && phase.status === "UNDER_REVIEW"
                          ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
                          : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]"
                    )}
                  >
                    {loading === tr.next ? "..." : t(tr.labelKey)}
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
