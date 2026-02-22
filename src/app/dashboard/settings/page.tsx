import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account and preferences
        </p>
      </div>

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
