"use client";

/**
 * @file components/ui/Sidebar.tsx
 * @description Main navigation sidebar for the dashboard layout.
 *
 * Renders a desktop sidebar (always visible, fixed-width on lg+) and a
 * mobile slide-out drawer (triggered by a top bar hamburger button), plus
 * a bottom tab bar on mobile showing the first four nav items.
 *
 * Features:
 *   - Role-based navigation: STAKEHOLDER/VIEWER receive a reduced set (no
 *     directory, activity, or settings links). ADMIN receives an extra admin
 *     panel link inserted before "Help".
 *   - Live unread notification badge via `useNotificationSSE`; seeded from
 *     the `unreadCount` prop (SSR value) and updated in real time by SSE.
 *   - Company logo/name shown if provided; falls back to HardHat icon and
 *     "Construction PM" text.
 *   - Mobile drawer: closes on route change and locks body scroll while open.
 *   - Global `<SearchPalette />` is mounted here so it is available on all
 *     dashboard pages. `<SearchButton />` in the sidebar triggers it via a
 *     synthetic Cmd+K keyboard event.
 *
 * Server actions: none (sign-out via `next-auth/react` `signOut`).
 * i18n namespaces: `nav`, `common`.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  Bell,
  LogOut,
  HardHat,
  Menu,
  X,
  BarChart3,
  HelpCircle,
  ScrollText,
  ShieldCheck,
  CreditCard,
  Mic,
} from "lucide-react";
import { SearchPalette, SearchButton } from "@/components/ui/SearchPalette";
import { useTranslations } from "next-intl";
import { useNotificationSSE } from "@/hooks/useNotificationSSE";

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: string;
    isOrgOwner?: boolean;
  };
  logoUrl?: string | null;
  companyName?: string | null;
  unreadCount?: number;
  keeneyMode?: boolean;
}

function getNavigation(role: string, isOrgOwner: boolean, t: (key: string) => string, keeneyMode?: boolean) {
  const base = [
    { name: t("dashboard"), href: "/dashboard", icon: LayoutDashboard },
    ...(keeneyMode ? [{ name: t("voiceMode"), href: "/dashboard/keeney", icon: Mic }] : []),
    { name: t("projects"), href: "/dashboard/projects", icon: FolderKanban },
    { name: t("reports"), href: "/dashboard/reports", icon: BarChart3 },
  ];

  if (role === "STAKEHOLDER" || role === "VIEWER") {
    return [
      ...base,
      { name: t("notifications"), href: "/dashboard/notifications", icon: Bell },
      { name: t("help"), href: "/dashboard/help", icon: HelpCircle },
    ];
  }

  const managerNav = [
    ...base,
    { name: t("directory"), href: "/dashboard/directory", icon: Users },
    { name: t("activityLog"), href: "/dashboard/activity", icon: ScrollText },
    { name: t("notifications"), href: "/dashboard/notifications", icon: Bell },
    { name: t("settings"), href: "/dashboard/settings", icon: Settings },
    { name: t("help"), href: "/dashboard/help", icon: HelpCircle },
  ];

  // Billing link for ADMIN or org owner — insert before help
  if (role === "ADMIN" || isOrgOwner) {
    managerNav.splice(managerNav.length - 1, 0, {
      name: t("billing"),
      href: "/dashboard/settings/billing",
      icon: CreditCard,
    });
  }

  if (role === "ADMIN") {
    // Insert admin link before help
    managerNav.splice(managerNav.length - 1, 0, {
      name: t("admin"),
      href: "/dashboard/admin",
      icon: ShieldCheck,
    });
  }

  return managerNav;
}

export function Sidebar({ user, logoUrl, companyName, unreadCount: initialUnread = 0, keeneyMode }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const navigation = getNavigation(user.role, user.isOrgOwner === true, t, keeneyMode);

  // Live unread count via SSE (#30)
  useNotificationSSE(setUnreadCount);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-200">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={companyName || "Logo"}
            className="w-7 h-7 rounded object-contain"
          />
        ) : (
          <HardHat className="w-7 h-7 text-[var(--color-primary)]" />
        )}
        <span className="text-lg font-bold text-gray-900 truncate">
          {companyName || "Construction PM"}
        </span>
        {/* Close button — mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto p-1 text-gray-400 hover:text-gray-600 lg:hidden"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <SearchButton />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--color-primary-bg)] text-[var(--color-primary-dark)]"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
              {item.href === "/dashboard/notifications" && unreadCount > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full bg-[var(--color-primary)] text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-bg)] flex items-center justify-center text-[var(--color-primary-dark)] text-sm font-medium shrink-0">
            {user.name?.[0] || user.email?.[0] || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.name || user.email}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {user.role.replace("_", " ").toLowerCase()}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            title={tc("signOut")}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 -ml-1.5 text-gray-600 hover:text-gray-900 rounded-lg"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={companyName || "Logo"}
            className="w-6 h-6 rounded object-contain"
          />
        ) : (
          <HardHat className="w-6 h-6 text-[var(--color-primary)]" />
        )}
        <span className="text-base font-bold text-gray-900 truncate">
          {companyName || "Construction PM"}
        </span>
        {unreadCount > 0 && (
          <Link
            href="/dashboard/notifications"
            className="ml-auto relative p-1.5"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--color-primary)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </Link>
        )}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl flex flex-col transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar — always visible on lg+ */}
      <div className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-gray-200 shrink-0">
        {sidebarContent}
      </div>

      {/* Global search palette */}
      <SearchPalette />

      {/* Mobile bottom tab bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center bg-white border-t border-gray-200 safe-area-inset-bottom">
        {navigation.slice(0, 4).map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors relative",
                isActive
                  ? "text-[var(--color-primary)]"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
              {item.href === "/dashboard/notifications" && unreadCount > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-14px)] w-4 h-4 bg-[var(--color-primary)] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}
