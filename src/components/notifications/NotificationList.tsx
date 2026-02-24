"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  HardHat,
  ClipboardCheck,
  FileText,
  FileCheck,
  UserPlus,
  Clock,
  CheckCircle2,
  Trash2,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotifications,
} from "@/actions/notifications";
import { toast } from "sonner";
import { formatDistanceToNow, isToday, isYesterday, subDays, isAfter } from "date-fns";
import { useTranslations } from "next-intl";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data: Record<string, unknown> | null;
  createdAt: Date;
}

interface Props {
  initialNotifications: Notification[];
  initialTotal: number;
  initialHasMore: boolean;
  unreadCount: number;
}

function getNotificationIcon(type: string) {
  const cls = "w-5 h-5";
  switch (type) {
    case "PHASE_STATUS_CHANGED":
      return <HardHat className={cn(cls, "text-[var(--color-primary)]")} />;
    case "REVIEW_REQUESTED":
      return <Clock className={cn(cls, "text-amber-500")} />;
    case "REVIEW_COMPLETED":
      return <CheckCircle2 className={cn(cls, "text-green-500")} />;
    case "CHECKLIST_COMPLETED":
      return <ClipboardCheck className={cn(cls, "text-green-500")} />;
    case "DOCUMENT_UPLOADED":
      return <FileText className={cn(cls, "text-amber-500")} />;
    case "DOCUMENT_STATUS_CHANGED":
      return <FileCheck className={cn(cls, "text-purple-500")} />;
    case "MEMBER_INVITED":
      return <UserPlus className={cn(cls, "text-[var(--color-primary)]")} />;
    case "TIMELINE_SHIFTED":
      return <Clock className={cn(cls, "text-red-500")} />;
    default:
      return <Bell className={cn(cls, "text-gray-400")} />;
  }
}

function getNotificationLink(data: Record<string, unknown> | null): string {
  if (!data) return "/dashboard";
  const projectId = data.projectId as string | undefined;
  const phaseId = data.phaseId as string | undefined;
  if (projectId && phaseId) {
    return `/dashboard/projects/${projectId}/phases/${phaseId}`;
  }
  if (projectId) {
    return `/dashboard/projects/${projectId}/timeline`;
  }
  return "/dashboard";
}

type DateGroup = "today" | "yesterday" | "thisWeek" | "older";

function groupByDate(notifications: Notification[]): Record<DateGroup, Notification[]> {
  const groups: Record<DateGroup, Notification[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  const weekAgo = subDays(new Date(), 7);

  for (const n of notifications) {
    const d = new Date(n.createdAt);
    if (isToday(d)) {
      groups.today.push(n);
    } else if (isYesterday(d)) {
      groups.yesterday.push(n);
    } else if (isAfter(d, weekAgo)) {
      groups.thisWeek.push(n);
    } else {
      groups.older.push(n);
    }
  }

  return groups;
}

export function NotificationList({
  initialNotifications,
  initialTotal,
  initialHasMore,
  unreadCount: initialUnreadCount,
}: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(initialUnreadCount);
  const [isPending, startTransition] = useTransition();
  const [loadingMore, setLoadingMore] = useState(false);
  const t = useTranslations("notifications");
  const tc = useTranslations("common");

  async function handleMarkAllRead() {
    startTransition(async () => {
      const result = await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
      toast.success(t("markAllRead"));
    });
  }

  async function handleClick(notification: Notification) {
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      setUnread((prev) => Math.max(0, prev - 1));
      markAsRead(notification.id); // fire-and-forget
    }
    const link = getNotificationLink(notification.data);
    router.push(link);
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const n = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (n && !n.read) setUnread((prev) => Math.max(0, prev - 1));
    deleteNotification(id); // fire-and-forget
    toast.success(t("deleted"));
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    const nextPage = page + 1;
    const result = await getNotifications(nextPage, 20);
    setNotifications((prev) => [
      ...prev,
      ...(result.notifications as Notification[]),
    ]);
    setHasMore(result.hasMore);
    setPage(nextPage);
    setLoadingMore(false);
  }

  const groups = groupByDate(notifications);
  const groupOrder: DateGroup[] = ["today", "yesterday", "thisWeek", "older"];
  const hasAny = notifications.length > 0;

  return (
    <div>
      {/* Header actions */}
      {hasAny && unread > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleMarkAllRead}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-bg)] rounded-lg transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            {t("markAllRead")}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!hasAny && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {t("noNotificationsYet")}
          </h3>
          <p className="text-sm text-gray-500">
            {t("emptyMessage")}
          </p>
        </div>
      )}

      {/* Grouped notifications */}
      {groupOrder.map((groupName) => {
        const items = groups[groupName];
        if (items.length === 0) return null;
        return (
          <div key={groupName} className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
              {tc(groupName)}
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {items.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleClick(notification)}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors group",
                    notification.read
                      ? "hover:bg-gray-50"
                      : "bg-[var(--color-primary-bg)]/40 hover:bg-[var(--color-primary-bg)]/60"
                  )}
                >
                  {/* Unread dot */}
                  <div className="mt-1.5 shrink-0 w-2">
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                    )}
                  </div>

                  {/* Icon */}
                  <div className="mt-0.5 shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm",
                        notification.read
                          ? "text-gray-700"
                          : "text-gray-900 font-medium"
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, notification.id)}
                    className="mt-1 p-1 text-gray-300 sm:opacity-0 sm:group-hover:opacity-100 hover:text-red-500 transition-all shrink-0"
                    title={tc("delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Load more */}
      {hasMore && (
        <div className="text-center mt-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-bg)] rounded-lg transition-colors disabled:opacity-50"
          >
            {loadingMore ? tc("loading") : tc("loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
