import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SystemAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SYSTEM_ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-red-600 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">System Admin</span>
          <span className="text-xs bg-red-800 px-2 py-1 rounded">
            GOD MODE
          </span>
        </div>
        <span className="text-sm opacity-80">
          {session.user.name || session.user.email}
        </span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
