import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getNotifications, getUnreadCount } from "@/actions/notifications";
import { NotificationList } from "@/components/notifications/NotificationList";

export default async function ContractorNotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [{ notifications, total, hasMore }, unreadCount] = await Promise.all([
    getNotifications(1, 20),
    getUnreadCount(),
  ]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-500 mt-1">
          Stay updated on your assignments
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary)] text-white">
              {unreadCount} unread
            </span>
          )}
        </p>
      </div>

      <NotificationList
        initialNotifications={notifications}
        initialTotal={total}
        initialHasMore={hasMore}
        unreadCount={unreadCount}
      />
    </div>
  );
}
