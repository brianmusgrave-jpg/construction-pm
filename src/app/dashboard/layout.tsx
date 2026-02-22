import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { getOrgSettings } from "@/actions/settings";
import { getThemeCSS } from "@/lib/themes";
import { getUnreadCount } from "@/actions/notifications";

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
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
