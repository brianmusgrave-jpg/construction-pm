/**
 * @file src/app/dashboard/layout.tsx
 * @description Dashboard shell layout. Renders the Sidebar, OnboardingTour, and
 * InstallPrompt, and applies the org theme CSS variable for all dashboard pages.
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { getOrgSettings } from "@/actions/settings";
import { getThemeCSS } from "@/lib/themes";
import { getUnreadCount } from "@/actions/notifications";
import { OnboardingTour } from "@/components/help/OnboardingTour";
import { InstallPrompt } from "@/components/ui/InstallPrompt";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [orgSettings, unreadCount] = await Promise.all([
    getOrgSettings(),
    getUnreadCount(),
  ]);
  const themeVars = getThemeCSS(orgSettings.theme);

  return (
    <div className="flex h-screen bg-gray-50" style={themeVars as React.CSSProperties}>
      <Sidebar
        user={session.user}
        logoUrl={orgSettings.logoUrl}
        companyName={orgSettings.companyName}
        unreadCount={unreadCount}
      />
      <main className="flex-1 overflow-auto pt-14 pb-16 lg:pt-0 lg:pb-0">
        <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
      </main>
      <OnboardingTour
        userRole={session.user.role || "VIEWER"}
        userName={session.user.name || undefined}
      />
      <InstallPrompt />
    </div>
  );
}
