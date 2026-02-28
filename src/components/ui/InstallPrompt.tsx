"use client";

/**
 * @file InstallPrompt.tsx
 * @description Progressive Web App install prompt banner. Listens for the browser's
 * beforeinstallprompt event and stores the deferred prompt for later invocation.
 * Suppressed for seven days after dismissal via a localStorage timestamp
 * (key: "pwa-install-dismissed"), and skipped entirely when the app is already running
 * in standalone display mode. Renders a fixed bottom-right card with a HardHat icon and
 * Install / Not Now actions; shows a success toast on acceptance.
 * i18n: pwa.
 */

import { useEffect, useState } from "react";
import { HardHat, X, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const t = useTranslations("pwa");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed recently
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < DISMISS_DURATION_MS) {
      return;
    }

    // Don't show if already installed (display-mode: standalone)
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      toast.success(t("installedToast"));
    }
    setDeferredPrompt(null);
    setVisible(false);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-80 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 flex gap-3 items-start">
      <div className="w-10 h-10 rounded-lg bg-[var(--color-primary-bg)] flex items-center justify-center shrink-0">
        <HardHat className="w-5 h-5 text-[var(--color-primary)]" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{t("installTitle")}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
          {t("installMessage")}
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {t("installButton")}
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {t("dismiss")}
          </button>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        className="p-0.5 text-gray-400 hover:text-gray-600 shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
