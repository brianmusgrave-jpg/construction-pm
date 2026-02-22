import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-500 mt-1">
          Stay updated on project activity
        </p>
      </div>

      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          No notifications yet
        </h3>
        <p className="text-sm text-gray-500">
          You&apos;ll be notified when there are updates to your projects.
        </p>
      </div>
    </div>
  );
}
