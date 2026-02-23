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

interface TourStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  tip?: string;
}

const ADMIN_STEPS: TourStep[] = [
  {
    icon: <Rocket className="w-8 h-8" />,
    title: "Welcome to Construction PM!",
    description:
      "Your all-in-one platform for managing construction projects. Let's take a quick tour of the key features.",
    tip: "This tour takes about 1 minute. You can skip it anytime.",
  },
  {
    icon: <FolderKanban className="w-8 h-8" />,
    title: "Projects & Timeline",
    description:
      "Create projects, set budgets, and break work into phases. The Timeline view gives you a Gantt chart showing how everything connects.",
    tip: "Start by creating your first project from the Projects page.",
  },
  {
    icon: <HardHat className="w-8 h-8" />,
    title: "Phase Management",
    description:
      "Each phase tracks status, costs, checklists, documents, and photos. Phases flow from Pending → In Progress → Review → Complete.",
    tip: "Use dependencies to link phases that must happen in sequence.",
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: "Team Collaboration",
    description:
      "Invite team members via email with specific roles. Contractors get their own simplified portal for uploading work and requesting reviews.",
    tip: "Invite your first team member from any project's Team section.",
  },
  {
    icon: <ClipboardCheck className="w-8 h-8" />,
    title: "Checklists & Documents",
    description:
      "Create reusable checklist templates in Settings and apply them to phases. Upload documents for approval tracking and photos for progress documentation.",
    tip: "Check Settings > Checklist Templates to set up your first template.",
  },
  {
    icon: <Bell className="w-8 h-8" />,
    title: "Notifications & Alerts",
    description:
      "Get notified about phase changes, review requests, and completed checklists via in-app, email, or SMS. Customize your preferences in Settings.",
    tip: "Set up quiet hours to avoid late-night notifications.",
  },
];

const CONTRACTOR_STEPS: TourStep[] = [
  {
    icon: <Rocket className="w-8 h-8" />,
    title: "Welcome to Construction PM!",
    description:
      "This is your Contractor Portal — a focused view of the phases you're assigned to. Let's walk through the basics.",
  },
  {
    icon: <HardHat className="w-8 h-8" />,
    title: "Your Assigned Phases",
    description:
      "Your dashboard shows all phases you're assigned to, grouped by status. Click any phase to see its details, checklist, and documents.",
    tip: "Complete checklist items as you finish each task.",
  },
  {
    icon: <Camera className="w-8 h-8" />,
    title: "Upload Photos & Documents",
    description:
      "Document your progress by uploading photos and relevant documents to each phase. This creates a clear record for your team.",
    tip: "Take photos regularly — they help during inspections and reviews.",
  },
  {
    icon: <ClipboardCheck className="w-8 h-8" />,
    title: "Request Reviews",
    description:
      "When you've completed work on a phase, click 'Request Review' to notify the project manager. They'll review and either approve or ask for changes.",
    tip: "Make sure all checklist items are done before requesting a review.",
  },
];

interface Props {
  userRole: string;
  userName?: string;
}

const TOUR_STORAGE_KEY = "construction-pm-tour-complete";

export function OnboardingTour({ userRole, userName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  const isContractor = userRole === "CONTRACTOR";
  const steps = isContractor ? CONTRACTOR_STEPS : ADMIN_STEPS;

  useEffect(() => {
    // Check if user has completed the tour
    const tourComplete = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!tourComplete) {
      // Delay slightly so the page loads first
      const timer = setTimeout(() => setIsOpen(true), 1000);
      return () => clearTimeout(timer);
    }
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
              ? `Welcome, ${userName}!`
              : currentStep.title}
          </h2>

          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            {currentStep.description}
          </p>

          {/* Tip */}
          {currentStep.tip && (
            <div className="bg-[var(--color-primary-bg)]/50 rounded-lg px-4 py-3 mb-6">
              <p className="text-xs text-[var(--color-primary-dark)] font-medium">
                💡 {currentStep.tip}
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
            Back
          </button>

          <div className="flex items-center gap-2">
            {!isLast && (
              <button
                onClick={completeTour}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Skip
              </button>
            )}
            <button
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-lg transition-colors"
            >
              {isLast ? "Get Started" : "Next"}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
