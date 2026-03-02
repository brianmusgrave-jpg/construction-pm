"use client";

/**
 * @file components/dashboard/widgets/AttentionWidget.tsx
 * @description "Needs Your Attention" widget showing review requests and overdue phases.
 */

import Link from "next/link";
import {
  Eye,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { cn, statusColor, statusLabel } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface AttentionPhase {
  id: string;
  name: string;
  status: string;
  estEnd: string;
  project: { id: string; name: string };
  assignee?: string;
}

interface Props {
  reviewPhases: AttentionPhase[];
  overduePhases: AttentionPhase[];
}

export function AttentionWidget({ reviewPhases, overduePhases }: Props) {
  const t = useTranslations("dashboard");
  const now = new Date();

  if (reviewPhases.length === 0 && overduePhases.length === 0) {
    return (
      <div className="p-6 text-center">
        <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">{t("allClear")}</p>
        <p className="text-xs text-gray-400 mt-1">{t("nothingNeedsAttention")}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {reviewPhases.map((phase) => (
        <Link
          key={phase.id}
          href={`/dashboard/projects/${phase.project.id}/phases/${phase.id}`}
          className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/50 transition-colors group"
        >
          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600 shrink-0">
            <Eye className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {t("reviewRequestedLabel", { name: phase.name })}
            </p>
            <p className="text-xs text-gray-500">
              {phase.project.name}
              {phase.assignee && ` · ${phase.assignee}`}
            </p>
          </div>
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full shrink-0",
              statusColor("REVIEW_REQUESTED")
            )}
          >
            {statusLabel("REVIEW_REQUESTED")}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
        </Link>
      ))}
      {overduePhases.slice(0, 4).map((phase) => {
        const daysOver = Math.ceil(
          (now.getTime() - new Date(phase.estEnd).getTime()) / 86400000
        );
        return (
          <Link
            key={phase.id}
            href={`/dashboard/projects/${phase.project.id}/phases/${phase.id}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50/50 transition-colors group"
          >
            <div className="p-1.5 rounded-lg bg-red-100 text-red-600 shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {t("overdueLabel", { name: phase.name })}
              </p>
              <p className="text-xs text-gray-500">
                {phase.project.name}
                {phase.assignee && ` · ${phase.assignee}`}
              </p>
            </div>
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
              {t("daysOverdue", { days: daysOver })}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-500 transition-colors shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}
