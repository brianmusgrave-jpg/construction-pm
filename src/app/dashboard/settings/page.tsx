import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { getOrgSettings } from "@/actions/settings";
import { getChecklistTemplates } from "@/actions/templates";
import { ThemeSelector } from "@/components/settings/ThemeSelector";
import { LogoUploader } from "@/components/settings/LogoUploader";
import { ChecklistTemplateManager } from "@/components/settings/ChecklistTemplateManager";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import {
  getNotificationPreferences,
  getUserPhone,
} from "@/actions/notification-preferences";
import { LanguagePicker } from "@/components/settings/LanguagePicker";
import { TotpSection } from "@/components/settings/TotpSection";
import { ApiKeySection } from "@/components/settings/ApiKeySection";
import { WebhookSection } from "@/components/settings/WebhookSection";
import { ReportScheduleSection } from "@/components/settings/ReportScheduleSection";
import { getTotpStatus } from "@/actions/totp";
import { getApiKeys } from "@/actions/api-keys";
import { getWebhooks } from "@/actions/webhooks";
import { getReportSchedules } from "@/actions/report-schedules";
import { QuickBooksSection } from "@/components/settings/QuickBooksSection";
import { getQuickBooksConnection, getQuickBooksSyncLogs } from "@/actions/quickbooks";
import { ProfileEditor } from "@/components/settings/ProfileEditor";
import { getProfile } from "@/actions/profile";
import { getLocale } from "@/i18n/locale";
import { getTranslations } from "next-intl/server";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [orgSettings, notifPrefs, userPhone, currentLocale, t] = await Promise.all([
    getOrgSettings(),
    getNotificationPreferences(),
    getUserPhone(),
    getLocale(),
    getTranslations("settings"),
  ]);
  const userRole = session.user.role || "VIEWER";
  const canManage = can(userRole, "manage", "phase");
  const templates = canManage ? await getChecklistTemplates() : [];

  // Sprint H — security & integrations (fetched in parallel, fall back gracefully)
  const [totpStatus, apiKeys, webhooks, reportSchedules] = await Promise.all([
    getTotpStatus().catch(() => ({ enabled: false, verified: false })),
    getApiKeys().catch(() => []),
    getWebhooks().catch(() => []),
    getReportSchedules().catch(() => []),
  ]);

  // Sprint N — QuickBooks integration
  const [qbConnection, qbSyncLogs] = await Promise.all([
    getQuickBooksConnection().catch(() => null),
    getQuickBooksSyncLogs().catch(() => []),
  ]);

  // Profile data for self-service editing
  const profile = await getProfile().catch(() => null);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* Profile section — self-service editing with change logging */}
      {profile && (
        <ProfileEditor user={profile} />
      )}

      {/* Two-Factor Authentication */}
      <div className="mt-6">
        <TotpSection enabled={totpStatus.enabled} verified={totpStatus.verified} />
      </div>

      {/* Language section */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t("language")}</h2>
        <p className="text-sm text-gray-500 mb-4">{t("languageDescription")}</p>
        <LanguagePicker currentLocale={currentLocale} />
      </div>

      {/* Appearance section (admin/PM only) */}
      {canManage && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6 space-y-8">
          <h2 className="text-lg font-semibold text-gray-900">{t("appearance")}</h2>

          <LogoUploader
            logoUrl={orgSettings.logoUrl}
            companyName={orgSettings.companyName}
          />

          <div className="border-t border-gray-100 pt-6">
            <ThemeSelector currentTheme={orgSettings.theme} />
          </div>
        </div>
      )}

      {/* Checklist Templates (admin/PM only) */}
      {canManage && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <ChecklistTemplateManager templates={templates} />
        </div>
      )}

      {/* Notification Preferences */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <NotificationSettings preferences={notifPrefs} phone={userPhone} />
      </div>

      {/* API Keys */}
      <div className="mt-6">
        <ApiKeySection apiKeys={apiKeys} />
      </div>

      {/* QuickBooks Integration */}
      {canManage && (
        <div className="mt-6">
          <QuickBooksSection connection={qbConnection} syncLogs={qbSyncLogs} />
        </div>
      )}

      {/* Webhooks */}
      <div className="mt-6">
        <WebhookSection webhooks={webhooks} />
      </div>

      {/* Automated Report Schedules (admin/PM only) */}
      {canManage && (
        <div className="mt-6">
          <ReportScheduleSection schedules={reportSchedules} />
        </div>
      )}
    </div>
  );
}
