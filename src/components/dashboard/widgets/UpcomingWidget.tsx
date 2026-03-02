"use client";

/**
 * @file components/dashboard/widgets/UpcomingWidget.tsx
 * @description Upcoming phases starting within 14 days.
 */

import Link from "next/link";
import { Clock, CheckCircle2 } from "lucide-react";
import { fmtShort } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface Phase {
  id: string;
  name: string;
  estStart: string;
  project: { id: string; name: string };
}

interface Props {
  phases: Phase[];
}

export function UpcomingWidget({ phases }: Props) {
  const t = useTranslations("dashboard");

  if (phases.length === 0) {
    return (
      <div className="p-6 text-center">
        <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">{t("noUpcoming")}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {phases.map((phase) => (
        <Link
          key={phase.id}
          href={`/dashboard/projects/${phase.project.id}/phases/${phase.id}`}
          className="flex items-center justify-between px-4 py-2.5 hover:bg-amber-50/50 transition-colors"
        >
          <div className="min-w-0">
            <span className="text-sm font-medium text-gray-900">{phase.name}</span>
            <span className="text-xs text-gray-500 ml-2">{phase.project.name}</span>
          </div>
          <span className="text-xs text-amber-700 shrink-0 ml-2">{fmtShort(phase.estStart)}</span>
        </Link>
      ))}
    </div>
  );
}
