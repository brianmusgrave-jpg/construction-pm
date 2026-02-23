import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HelpCenter } from "@/components/help/HelpCenter";

export default async function HelpPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Help Center</h1>
        <p className="text-sm text-gray-500 mt-1">
          Guides, tips, and answers to common questions
        </p>
      </div>
      <HelpCenter userRole={session.user.role || "VIEWER"} />
    </div>
  );
}
