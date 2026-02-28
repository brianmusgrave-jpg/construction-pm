/**
 * @file src/app/dashboard/notifications/page.tsx
 * @description Full notifications page. Loads the first 20 notifications, unread
 * count, and i18n strings, then renders NotificationList for the authenticated user.
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getNotifications, getUnreadCount } from "@/actions/notifications";
import { NotificationList } from "@/components/notifications/NotificationList";
import { getTranslations } from "next-intl/server";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [{ notifications, total, hasMore }, unreadCount, t] = await Promise.all([
    getNotifications(1, 20),
    getUnreadCount(),
    getTranslations("notifications"),
  ]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("emptyMessage").split(".")[0]}
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
