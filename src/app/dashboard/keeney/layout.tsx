/**
 * @file src/app/dashboard/keeney/layout.tsx
 * @description Minimal layout for Keeney Mode — no sidebar, full-screen mic interface.
 * Sprint 21
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOrgSettings } from "@/actions/settings";
import { getThemeCSS } from "@/lib/themes";

export default async function KeeneyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgSettings = await getOrgSettings();
  const themeVars = getThemeCSS(orgSettings.theme);

  return (
    <div
      className="flex flex-col h-screen bg-gray-50"
      style={themeVars as React.CSSProperties}
    >
      {children}
    </div>
  );
}
