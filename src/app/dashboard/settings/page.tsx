import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { getOrgSettings } from "@/actions/settings";
import { getChecklistTemplates } from "@/actions/templates";
import { ThemeSelector } from "@/components/settings/ThemeSelector";
import { LogoUploader } from "@/components/settings/LogoUploader";
import { ChecklistTemplateManager } from "@/components/settings/ChecklistTemplateManager";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgSettings = await getOrgSettings();
  const userRole = session.user.role || "VIEWER";
  const canManage = can(userRole, "manage", "phase");
  const templates = canManage ? await getChecklistTemplates() : [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-0.5">
              Name
            </label>
            <p className="text-base text-gray-900">
              {session.user.name || "Not set"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-0.5">
              Email
            </label>
            <p className="text-base text-gray-900">{session.user.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-0.5">
              Role
            </label>
            <p className="text-base text-gray-900 capitalize">
              {(session.user.role || "viewer").replace("_", " ").toLowerCase()}
            </p>
          </div>
        </div>
      </div>

      {/* Appearance section (admin/PM only) */}
      {canManage && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6 space-y-8">
          <h2 className="text-lg font-semibold text-gray-900">Appearance</h2>

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

      {/* Notifications placeholder */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Notification Preferences
        </h2>
        <p className="text-sm text-gray-500">
          Email and SMS notification settings coming soon.
        </p>
      </div>
    </div>
  );
}
