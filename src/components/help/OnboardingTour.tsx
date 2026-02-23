"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface TourStep {
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
  tipKey?: string;
}

const ADMIN_STEPS: TourStep[] = [
  { icon: <Rocket className="w-8 h-8" />, titleKey: "welcomeTitle", descKey: "welcomeDesc", tipKey: "welcomeTip" },
  { icon: <FolderKanban className="w-8 h-8" />, titleKey: "projectsTitle", descKey: "projectsDesc", tipKey: "projectsTip" },
  { icon: <HardHat className="w-8 h-8" />, titleKey: "phasesTitle", descKey: "phasesDesc", tipKey: "phasesTip" },
  { icon: <Users className="w-8 h-8" />, titleKey: "teamTitle", descKey: "teamDesc", tipKey: "teamTip" },
  { icon: <ClipboardCheck className="w-8 h-8" />, titleKey: "checklistsTitle", descKey: "checklistsDesc", tipKey: "checklistsTip" },
  { icon: <Bell className="w-8 h-8" />, titleKey: "notificationsTitle", descKey: "notificationsDesc", tipKey: "notificationsTip" },
];

const CONTRACTOR_STEPS: TourStep[] = [
  { icon: <Rocket className="w-8 h-8" />, titleKey: "welcomeTitle", descKey: "contractorWelcomeDesc" },
  { icon: <HardHat className="w-8 h-8" />, titleKey: "assignedTitle", descKey: "assignedDesc", tipKey: "assignedTip" },
  { icon: <Camera className="w-8 h-8" />, titleKey: "uploadTitle", descKey: "uploadDesc", tipKey: "uploadTip" },
  { icon: <ClipboardCheck className="w-8 h-8" />, titleKey: "reviewTitle", descKey: "reviewDesc", tipKey: "reviewTip" },
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
            <div className="bg-[var(--color-primary-bg)]/50 rounded-lg px-4 py-3 mb-6">
              <p className="text-xs text-[var(--color-primary-dark)] font-medium">
                💡 {t(currentStep.tipKey)}
              </p>
            </div>
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
