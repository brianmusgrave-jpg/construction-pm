"use client";

/**
 * @file components/dashboard/widgets/ActivityWidget.tsx
 * @description Recent activity feed widget.
 */

import {
  Activity,
  HardHat,
  Users,
  ClipboardCheck,
  FileText,
} from "lucide-react";
import { cn, fmtRelative } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ActivityEntry {
  id: string;
  action: string;
  message: string;
  createdAt: string;
  userName: string;
  projectName: string;
}

interface Props {
  entries: ActivityEntry[];
}

function getActivityIcon(action: string): React.ReactNode {
  const cls = "w-3.5 h-3.5";
  switch (action) {
    case "PHASE_STATUS_CHANGED":
      return <HardHat className={cn(cls, "text-blue-500")} />;
    case "STAFF_ASSIGNED":
    case "STAFF_UNASSIGNED":
      return <Users className={cn(cls, "text-purple-500")} />;
    case "CHECKLIST_APPLIED":
    case "CHECKLIST_ITEM_TOGGLED":
      return <ClipboardCheck className={cn(cls, "text-green-500")} />;
    case "DOCUMENT_UPLOADED":
      return <FileText className={cn(cls, "text-amber-500")} />;
    default:
      return <Activity className={cn(cls, "text-gray-400")} />;
  }
}

export function ActivityWidget({ entries }: Props) {
  const t = useTranslations("dashboard");

  if (entries.length === 0) {
    return (
      <div className="p-6 text-center">
        <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">{t("noActivityYet")}</p>
        <p className="text-xs text-gray-400 mt-1">{t("activityWillAppear")}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {entries.map((entry) => (
        <div key={entry.id} className="px-4 py-2.5">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 shrink-0">{getActivityIcon(entry.action)}</div>
            <div className="min-w-0">
              <p className="text-sm text-gray-900">{entry.message}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-gray-500">{entry.userName}</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-400">{fmtRelative(entry.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
