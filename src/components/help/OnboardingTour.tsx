"use client";

/**
 * @file components/help/OnboardingTour.tsx
 * @description First-run modal tour shown to new users after a 1-second delay.
 *
 * Steps:
 *   - ADMIN_STEPS (10): Welcome, Projects, Phases, Team, Checklists, Change Orders,
 *     Analytics, Offline, Advanced, Notifications.
 *   - CONTRACTOR_STEPS (5): Welcome, Assigned Phases, Upload Photos, Request Review,
 *     Offline.
 *   Component receives `userRole` and renders the appropriate step set.
 *
 * Each step has an icon, title, description, optional tip (shown in a primary-
 *   bg callout), and an optional `learnMore` link that navigates to
 *   `/dashboard/help?section=…&article=…` and marks the tour complete.
 *
 * Persistence: tour completion stored in `localStorage` under `TOUR_STORAGE_KEY`
 *   (`"construction-pm-tour-complete"`). Set to prevent re-showing; cleared by
 *   `resetTour()` which also dispatches a `"replay-tour"` window event picked up
 *   by the effect listener.
 *
 * Exports:
 *   `TOUR_STORAGE_KEY` — the localStorage key constant.
 *   `resetTour()` — clears the key and triggers replay via window event.
 *
 * UI: progress bar + pill dot indicator; back / skip / next-or-"Get Started"
 *   buttons. Clicking the backdrop calls `completeTour()`.
 *
 * i18n namespaces: `tour`, `common`.
 */

import { useState, useEffect } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  FolderKanban,
  HardHat,
  Users,
  ClipboardCheck,
  Camera,
  Bell,
  Rocket,
  Receipt,
  WifiOff,
  BarChart3,
  Globe,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface TourStep {
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
  tipKey?: string;
  /** help center section + article to deep-link on "Learn More" */
  learnMore?: { section: string; article: string };
}

const ADMIN_STEPS: TourStep[] = [
  {
    icon: <Rocket className="w-8 h-8" />,
    titleKey: "welcomeTitle",
    descKey: "welcomeDesc",
    tipKey: "welcomeTip",
    learnMore: { section: "getting-started", article: "gs-overview" },
  },
  {
    icon: <FolderKanban className="w-8 h-8" />,
    titleKey: "projectsTitle",
    descKey: "projectsDesc",
    tipKey: "projectsTip",
    learnMore: { section: "projects", article: "proj-overview" },
  },
  {
    icon: <HardHat className="w-8 h-8" />,
    titleKey: "phasesTitle",
    descKey: "phasesDesc",
    tipKey: "phasesTip",
    learnMore: { section: "phases", article: "phase-lifecycle" },
  },
  {
    icon: <Users className="w-8 h-8" />,
    titleKey: "teamTitle",
    descKey: "teamDesc",
    tipKey: "teamTip",
    learnMore: { section: "team", article: "team-invite" },
  },
  {
    icon: <ClipboardCheck className="w-8 h-8" />,
    titleKey: "checklistsTitle",
    descKey: "checklistsDesc",
    tipKey: "checklistsTip",
    learnMore: { section: "checklists", article: "check-templates" },
  },
  {
    icon: <Receipt className="w-8 h-8" />,
    titleKey: "changeOrdersTitle",
    descKey: "changeOrdersDesc",
    tipKey: "changeOrdersTip",
    learnMore: { section: "change-orders", article: "co-overview" },
  },
  {
    icon: <BarChart3 className="w-8 h-8" />,
    titleKey: "analyticsTitle",
    descKey: "analyticsDesc",
    tipKey: "analyticsTip",
    learnMore: { section: "analytics", article: "analytics-dash" },
  },
  {
    icon: <WifiOff className="w-8 h-8" />,
    titleKey: "offlineTitle",
    descKey: "offlineDesc",
    tipKey: "offlineTip",
    learnMore: { section: "offline", article: "offline-mode" },
  },
  {
    icon: <Globe className="w-8 h-8" />,
    titleKey: "advancedTitle",
    descKey: "advancedDesc",
    tipKey: "advancedTip",
    learnMore: { section: "advanced", article: "adv-client-portal" },
  },
  {
    icon: <Bell className="w-8 h-8" />,
    titleKey: "notificationsTitle",
    descKey: "notificationsDesc",
    tipKey: "notificationsTip",
    learnMore: { section: "notifications", article: "notif-channels" },
  },
];

const CONTRACTOR_STEPS: TourStep[] = [
  {
    icon: <Rocket className="w-8 h-8" />,
    titleKey: "welcomeTitle",
    descKey: "contractorWelcomeDesc",
    learnMore: { section: "getting-started", article: "gs-overview" },
  },
  {
    icon: <HardHat className="w-8 h-8" />,
    titleKey: "assignedTitle",
    descKey: "assignedDesc",
    tipKey: "assignedTip",
    learnMore: { section: "phases", article: "phase-lifecycle" },
  },
  {
    icon: <Camera className="w-8 h-8" />,
    titleKey: "uploadTitle",
    descKey: "uploadDesc",
    tipKey: "uploadTip",
    learnMore: { section: "photos", article: "photo-progress" },
  },
  {
    icon: <ClipboardCheck className="w-8 h-8" />,
    titleKey: "reviewTitle",
    descKey: "reviewDesc",
    tipKey: "reviewTip",
    learnMore: { section: "checklists", article: "check-templates" },
  },
  {
    icon: <WifiOff className="w-8 h-8" />,
    titleKey: "offlineTitle",
    descKey: "offlineContractorDesc",
    tipKey: "offlineTip",
    learnMore: { section: "offline", article: "offline-mode" },
  },
];

interface Props {
  userRole: string;
  userName?: string;
}

export const TOUR_STORAGE_KEY = "construction-pm-tour-complete";

/** Call this to clear the tour flag and trigger a page-level re-render */
export function resetTour() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
  window.dispatchEvent(new Event("replay-tour"));
}

/**
 * Navigates to the help page with section + article params so the
 * HelpCenter auto-expands the right article.
 */
function navigateToHelp(section: string, article: string) {
  window.location.href = `/dashboard/help?section=${section}&article=${article}`;
}

export function OnboardingTour({ userRole, userName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const t = useTranslations("tour");
  const tc = useTranslations("common");

  const isContractor = userRole === "CONTRACTOR";
  const steps = isContractor ? CONTRACTOR_STEPS : ADMIN_STEPS;

  useEffect(() => {
    const tourComplete = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!tourComplete) {
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }

    function handleReplay() {
      setStep(0);
      setIsOpen(true);
    }
    window.addEventListener("replay-tour", handleReplay);
    return () => window.removeEventListener("replay-tour", handleReplay);
  }, []);

  function completeTour() {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setIsOpen(false);
  }

  function handleNext() {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      completeTour();
    }
  }

  function handlePrev() {
    if (step > 0) setStep(step - 1);
  }

  function handleLearnMore() {
    const lm = steps[step]?.learnMore;
    if (lm) {
      completeTour();
      navigateToHelp(lm.section, lm.article);
    }
  }

  if (!isOpen) return null;

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={completeTour}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-[var(--color-primary)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={completeTour}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8 text-center">
          {/* Step counter */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === step
                    ? "w-6 bg-[var(--color-primary)]"
                    : i < step
                    ? "bg-[var(--color-primary)]/40"
                    : "bg-gray-200"
                )}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-primary-bg)] text-[var(--color-primary)] mb-5">
            {currentStep.icon}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {step === 0 && userName
              ? t("welcomeUser", { name: userName })
              : t(currentStep.titleKey)}
          </h2>

          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            {t(currentStep.descKey)}
          </p>

          {/* Tip */}
          {currentStep.tipKey && (
            <div className="bg-[var(--color-primary-bg)]/50 rounded-lg px-4 py-3 mb-2">
              <p className="text-xs text-[var(--color-primary-dark)] font-medium">
                💡 {t(currentStep.tipKey)}
              </p>
            </div>
          )}

          {/* Learn More link */}
          {currentStep.learnMore && (
            <button
              onClick={handleLearnMore}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors mt-2"
            >
              <BookOpen className="w-3.5 h-3.5" />
              {t("learnMore")}
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-8 pb-8">
          <button
            onClick={handlePrev}
            disabled={step === 0}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              step === 0
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            {tc("back")}
          </button>

          <div className="flex items-center gap-2">
            {!isLast && (
              <button
                onClick={completeTour}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                {t("skip")}
              </button>
            )}
            <button
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-lg transition-colors"
            >
              {isLast ? t("getStarted") : tc("next")}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
