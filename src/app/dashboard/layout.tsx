/**
 * @file src/app/dashboard/layout.tsx
 * @description Dashboard shell layout. Renders the Sidebar, OnboardingTour,
 * InstallPrompt, and Keeney FAB. Applies the org theme CSS variables.
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { getOrgSettings } from "@/actions/settings";
import { getThemeCSS } from "@/lib/themes";
import { getUnreadCount } from "@/actions/notifications";
import { getKeeneyModeStatus } from "@/actions/keeney";
import { OnboardingTour } from "@/components/help/OnboardingTour";
import { InstallPrompt } from "@/components/ui/InstallPrompt";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";
import { KeeneyFAB } from "@/components/keeney/KeeneyFAB";
import ImpersonationBanner from "@/app/system-admin/components/ImpersonationBanner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [orgSettings, unreadCount, keeneyMode] = await Promise.all([
    getOrgSettings(),
    getUnreadCount(),
    getKeeneyModeStatus().catch(() => false),
  ]);
  const themeVars = getThemeCSS(orgSettings.theme);

  return (
    <div className="flex h-screen bg-gray-50" style={themeVars as React.CSSProperties}>
      <ImpersonationBanner />
      <Sidebar
        user={session.user}
        logoUrl={orgSettings.logoUrl}
        companyName={orgSettings.companyName}
        unreadCount={unreadCount}
        keeneyMode={keeneyMode}
      />
      <main className="flex-1 overflow-auto pt-14 pb-16 lg:pt-0 lg:pb-0">
        <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
      </main>
      <OnboardingTour
        userRole={session.user.role || "VIEWER"}
        userName={session.user.name || undefined}
      />
      <InstallPrompt />
      <KeeneyFAB enabled={keeneyMode} />
    </div>
  );
}
