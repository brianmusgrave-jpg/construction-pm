"use client";

/**
 * @file components/dashboard/widgets/NotificationsWidget.tsx
 * @description Recent notifications widget with unread indicators.
 */

import Link from "next/link";
import { Bell } from "lucide-react";
import { cn, fmtRelative } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface Props {
  notifications: Notification[];
}

export function NotificationsWidget({ notifications }: Props) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");

  if (notifications.length === 0) {
    return (
      <div className="p-6 text-center">
        <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">{t("noNotificationsYet")}</p>
        <p className="text-xs text-gray-400 mt-1">{t("notificationsWillAppear")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-gray-100">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={cn("px-4 py-2.5 transition-colors", !notif.read && "bg-blue-50/40")}
          >
            <div className="flex items-start gap-2">
              {!notif.read && (
                <span className="mt-1.5 w-2 h-2 rounded-full bg-[var(--color-primary)] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm truncate",
                    !notif.read ? "font-medium text-gray-900" : "text-gray-700"
                  )}
                >
                  {notif.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.message}</p>
                <p className="text-xs text-gray-400 mt-0.5">{fmtRelative(notif.createdAt)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t bg-gray-50/50">
        <Link
          href="/dashboard/notifications"
          className="text-xs text-[var(--color-primary)] hover:underline"
        >
          {tc("viewAll")}
        </Link>
      </div>
    </div>
  );
}
