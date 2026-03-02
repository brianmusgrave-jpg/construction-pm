"use client";

/**
 * @file components/dashboard/widgets/KPIWidget.tsx
 * @description KPI summary cards widget — shows active phases, reviews,
 * overdue, pending docs, and checklist progress.
 */

import {
  HardHat,
  Eye,
  AlertTriangle,
  FileText,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type CardColor = "blue" | "red" | "green" | "amber";

interface Props {
  activePhases: number;
  totalPhases: number;
  reviewPhases: number;
  overduePhases: number;
  pendingDocs: number;
  checklistPercent: number;
  completedItems: number;
  totalItems: number;
}

export function KPIWidget(props: Props) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");

  const reviewColor: CardColor = props.reviewPhases > 0 ? "amber" : "green";
  const overdueColor: CardColor = props.overduePhases > 0 ? "red" : "green";
  const docsColor: CardColor = props.pendingDocs > 0 ? "amber" : "green";
  const checkColor: CardColor = props.checklistPercent >= 80 ? "green" : props.checklistPercent >= 50 ? "blue" : "amber";

  const cards: { icon: React.ReactNode; label: string; value: number; valueSuffix?: string; color: CardColor; detail: string }[] = [
    {
      icon: <HardHat className="w-5 h-5" />,
      label: t("activePhases"),
      value: props.activePhases,
      color: "blue",
      detail: `${props.totalPhases} ${tc("total")}`,
    },
    {
      icon: <Eye className="w-5 h-5" />,
      label: t("needsReview"),
      value: props.reviewPhases,
      color: reviewColor,
      detail: props.reviewPhases > 0 ? t("awaitingApproval") : t("allClear"),
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      label: t("overdue"),
      value: props.overduePhases,
      color: overdueColor,
      detail: props.overduePhases > 0 ? t("pastDeadline") : t("onTrack"),
    },
    {
      icon: <FileText className="w-5 h-5" />,
      label: t("pendingDocs"),
      value: props.pendingDocs,
      color: docsColor,
      detail: props.pendingDocs > 0 ? t("needReview") : t("allReviewed"),
    },
    {
      icon: <ClipboardCheck className="w-5 h-5" />,
      label: t("checklists"),
      value: props.checklistPercent,
      valueSuffix: "%",
      color: checkColor,
      detail: `${props.completedItems}/${props.totalItems} ${tc("items")}`,
    },
  ];

  const colorMap: Record<CardColor, string> = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    red: "bg-red-50 text-red-600 border-red-100",
    green: "bg-green-50 text-green-600 border-green-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
  };
  const iconBg: Record<CardColor, string> = {
    blue: "bg-blue-100 text-blue-600",
    red: "bg-red-100 text-red-600",
    green: "bg-green-100 text-green-600",
    amber: "bg-amber-100 text-amber-600",
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 p-4 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            "rounded-xl border p-3 transition-colors min-w-[130px] sm:min-w-0 shrink-0 sm:shrink",
            colorMap[card.color]
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className={cn("p-1.5 rounded-lg", iconBg[card.color])}>
              {card.icon}
            </div>
            <div>
              <p className="text-xl font-bold leading-tight">
                {card.value}
                {card.valueSuffix && (
                  <span className="text-sm font-semibold">{card.valueSuffix}</span>
                )}
              </p>
              <p className="text-[11px] font-medium opacity-80">{card.label}</p>
            </div>
          </div>
          <p className="text-[11px] mt-1.5 opacity-70">{card.detail}</p>
        </div>
      ))}
    </div>
  );
}
