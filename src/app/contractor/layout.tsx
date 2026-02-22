import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ContractorNav } from "@/components/contractor/ContractorNav";

export default async function ContractorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Only contractors use this portal; others go to main dashboard
  if (session.user.role !== "CONTRACTOR") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <ContractorNav user={session.user} />
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
