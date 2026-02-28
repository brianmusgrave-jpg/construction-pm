"use client";

/**
 * @file NotificationSettings.tsx
 * @description Notification preference editor with three channel toggles: in-app, email,
 * and SMS. Email preferences cover five event types (phase status, review, checklist,
 * docs, comments); SMS covers four. Enabling the SMS channel reveals a phone number
 * input. Quiet hours accepts a start and end time. Save persists all preferences via
 * updateNotificationPreferences() and conditionally updates the phone number via
 * updatePhoneNumber() when changed. Includes local Toggle and PreferenceRow sub-
 * components. Server actions: updateNotificationPreferences, updatePhoneNumber.
 * i18n: notifPrefs, common.
 */

import { useState, useTransition } from "react";
import { Bell, Mail, MessageSquare, Phone, Moon, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  updateNotificationPreferences,
  updatePhoneNumber,
} from "@/actions/notification-preferences";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  emailPhaseStatus: boolean;
  emailReview: boolean;
  emailChecklist: boolean;
  emailDocuments: boolean;
  emailComments: boolean;
  smsPhaseStatus: boolean;
  smsReview: boolean;
  smsChecklist: boolean;
  smsDocuments: boolean;
  quietStart: string | null;
  quietEnd: string | null;
}

interface Props {
  preferences: NotificationPreferences;
  phone: string | null;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked
          ? "bg-[var(--color-primary)]"
          : "bg-gray-200",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

export function NotificationSettings({ preferences: initial, phone: initialPhone }: Props) {
  const [prefs, setPrefs] = useState(initial);
  const [phone, setPhone] = useState(initialPhone || "");
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("notifPrefs");
  const tc = useTranslations("common");

  function update<K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        // Save preferences
        await updateNotificationPreferences(prefs);

        // Save phone number
        if (phone !== (initialPhone || "")) {
          await updatePhoneNumber(phone);
        }

        toast.success(t("saved"));
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : t("failedToSave");
        toast.error(msg);
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("title")}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {t("subtitle")}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-lg transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isPending ? tc("saving") : tc("save")}
        </button>
      </div>

      {/* Channel Toggles */}
      <div className="space-y-4 mb-8">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          {t("channels")}
        </h3>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">{t("inApp")}</p>
              <p className="text-xs text-gray-500">{t("inAppDesc")}</p>
            </div>
          </div>
          <Toggle checked={prefs.inAppEnabled} onChange={(v) => update("inAppEnabled", v)} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">{t("emailNotifs")}</p>
              <p className="text-xs text-gray-500">{t("emailNotifsDesc")}</p>
            </div>
          </div>
          <Toggle checked={prefs.emailEnabled} onChange={(v) => update("emailEnabled", v)} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">{t("smsNotifs")}</p>
              <p className="text-xs text-gray-500">{t("smsNotifsDesc")}</p>
            </div>
          </div>
          <Toggle checked={prefs.smsEnabled} onChange={(v) => update("smsEnabled", v)} />
        </div>

        {/* Phone number input (shown when SMS is enabled) */}
        {prefs.smsEnabled && (
          <div className="ml-8 pl-3 border-l-2 border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("phoneNumber")}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("phonePlaceholder")}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t("phoneHelp")}
            </p>
          </div>
        )}
      </div>

      {/* Email Preferences */}
      {prefs.emailEnabled && (
        <div className="space-y-3 mb-8">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            {t("emailAlerts")}
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <PreferenceRow
              label={t("phaseStatusChanges")}
              description={t("phaseStatusDesc")}
              checked={prefs.emailPhaseStatus}
              onChange={(v) => update("emailPhaseStatus", v)}
            />
            <PreferenceRow
              label={t("reviewRequests")}
              description={t("reviewRequestsDesc")}
              checked={prefs.emailReview}
              onChange={(v) => update("emailReview", v)}
            />
            <PreferenceRow
              label={t("checklistCompletion")}
              description={t("checklistDesc")}
              checked={prefs.emailChecklist}
              onChange={(v) => update("emailChecklist", v)}
            />
            <PreferenceRow
              label={t("documentUpdates")}
              description={t("documentDesc")}
              checked={prefs.emailDocuments}
              onChange={(v) => update("emailDocuments", v)}
            />
            <PreferenceRow
              label={t("commentsLabel")}
              description={t("commentsDesc")}
              checked={prefs.emailComments}
              onChange={(v) => update("emailComments", v)}
            />
          </div>
        </div>
      )}

      {/* SMS Preferences */}
      {prefs.smsEnabled && (
        <div className="space-y-3 mb-8">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            {t("smsAlerts")}
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <PreferenceRow
              label={t("phaseStatusChanges")}
              description={t("phaseStatusSmsDesc")}
              checked={prefs.smsPhaseStatus}
              onChange={(v) => update("smsPhaseStatus", v)}
            />
            <PreferenceRow
              label={t("reviewRequests")}
              description={t("reviewRequestsSmsDesc")}
              checked={prefs.smsReview}
              onChange={(v) => update("smsReview", v)}
            />
            <PreferenceRow
              label={t("checklistCompletion")}
              description={t("checklistSmsDesc")}
              checked={prefs.smsChecklist}
              onChange={(v) => update("smsChecklist", v)}
            />
            <PreferenceRow
              label={t("documentUpdates")}
              description={t("documentSmsDesc")}
              checked={prefs.smsDocuments}
              onChange={(v) => update("smsDocuments", v)}
            />
          </div>
        </div>
      )}

      {/* Quiet Hours */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          <Moon className="w-4 h-4 text-gray-400" />
          {t("quietHours")}
        </h3>
        <p className="text-xs text-gray-500">
          {t("quietHoursDesc")}
        </p>
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{tc("from")}</label>
            <input
              type="time"
              value={prefs.quietStart || ""}
              onChange={(e) => update("quietStart", e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
            />
          </div>
          <span className="mt-5 text-gray-400">—</span>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{tc("to")}</label>
            <input
              type="time"
              value={prefs.quietEnd || ""}
              onChange={(e) => update("quietEnd", e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreferenceRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}
