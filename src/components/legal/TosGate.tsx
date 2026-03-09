/**
 * @file src/components/legal/TosGate.tsx
 * @description Modal gate that blocks app access until user accepts the current TOS.
 * Rendered in the dashboard layout — only shows when acceptance is needed.
 */
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { acceptTos } from "@/actions/tos";
import { toast } from "sonner";
import { ScrollText, Check } from "lucide-react";

interface TosGateProps {
  currentVersion: string;
  isReaffirmation: boolean;
}

export function TosGate({ currentVersion, isReaffirmation }: TosGateProps) {
  const t = useTranslations("tos");
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const router = useRouter();

  async function handleAccept() {
    if (!checked) return;
    setSaving(true);
    const result = await acceptTos();
    if (result.success) {
      toast.success(t("accepted"));
      router.refresh();
    } else {
      toast.error(result.error || t("acceptFailed"));
    }
    setSaving(false);
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom && !scrolledToBottom) {
      setScrolledToBottom(true);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center gap-3">
          <ScrollText className="w-6 h-6 text-yellow-600" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isReaffirmation ? t("reaffirmTitle") : t("title")}
            </h2>
            <p className="text-sm text-gray-500">
              {t("version", { version: currentVersion })}
            </p>
          </div>
        </div>

        {/* Scrollable TOS content */}
        <div
          className="flex-1 overflow-y-auto p-6 text-sm text-gray-700 leading-relaxed space-y-4"
          onScroll={handleScroll}
        >
          <h3 className="font-semibold text-gray-900">{t("section1Title")}</h3>
          <p>{t("section1Body")}</p>

          <h3 className="font-semibold text-gray-900">{t("section2Title")}</h3>
          <p>{t("section2Body")}</p>

          <h3 className="font-semibold text-gray-900">{t("section3Title")}</h3>
          <p>{t("section3Body")}</p>

          <h3 className="font-semibold text-gray-900">{t("section4Title")}</h3>
          <p>{t("section4Body")}</p>

          <h3 className="font-semibold text-gray-900">{t("section5Title")}</h3>
          <p>{t("section5Body")}</p>

          <h3 className="font-semibold text-gray-900">{t("section6Title")}</h3>
          <p>{t("section6Body")}</p>

          <h3 className="font-semibold text-gray-900">{t("section7Title")}</h3>
          <p>{t("section7Body")}</p>

          <h3 className="font-semibold text-gray-900">{t("section8Title")}</h3>
          <p>{t("section8Body")}</p>
        </div>

        {/* Footer with checkbox + accept */}
        <div className="p-6 border-t space-y-4">
          {!scrolledToBottom && (
            <p className="text-xs text-amber-600 text-center">{t("scrollHint")}</p>
          )}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              disabled={!scrolledToBottom}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
            />
            <span className="text-sm text-gray-700">
              {t("checkboxLabel")}
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!checked || saving}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-lg text-white font-semibold transition-all disabled:opacity-40"
            style={{ backgroundColor: checked ? "#111010" : "#9ca3af" }}
          >
            <Check className="w-4 h-4" />
            {saving ? t("accepting") : t("acceptButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
