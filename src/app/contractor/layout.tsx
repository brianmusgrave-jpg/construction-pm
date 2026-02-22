import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ContractorNav } from "@/components/contractor/ContractorNav";
import { getOrgSettings } from "@/actions/settings";
import { getThemeCSS } from "@/lib/themes";

export default async function ContractorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Only contractors use this portal; others go to main dashboard
  if (session.user.role !== "CONTRACTOR") redirect("/dashboard");

  const orgSettings = await getOrgSettings();
  const themeVars = getThemeCSS(orgSettings.theme);

  return (
    <div className="min-h-screen bg-gray-50" style={themeVars as React.CSSProperties}>
      <ContractorNav
        user={session.user}
        logoUrl={orgSettings.logoUrl}
        companyName={orgSettings.companyName}
      />
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
