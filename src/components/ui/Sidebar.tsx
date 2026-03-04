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
      {/* Logo / brand header */}
      <div
        className="flex items-center gap-2 px-4 py-5 border-b"
        style={{ borderColor: "var(--nav-border)" }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={companyName || "Logo"}
            className="w-7 h-7 rounded object-contain"
          />
        ) : (
          <HardHat className="w-7 h-7" style={{ color: "var(--nav-accent)" }} />
        )}
        <span
          className="text-lg font-bold truncate"
          style={{ color: "var(--nav-fg)", fontFamily: "var(--font-oswald, inherit)" }}
        >
          {companyName || "AccuDone"}
        </span>
        {/* Close button — mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto p-1 opacity-60 hover:opacity-100 lg:hidden"
          style={{ color: "var(--nav-fg)" }}
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
                isActive ? "nav-item-active" : "nav-item-inactive"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.name}
              {item.href === "/dashboard/notifications" && unreadCount > 0 && (
                <span
                  className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full"
                  style={{
                    backgroundColor: "var(--nav-accent)",
                    color: "var(--nav-accent-fg)",
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div
        className="border-t p-4"
        style={{ borderColor: "var(--nav-border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{
              backgroundColor: "var(--nav-accent)",
              color: "var(--nav-accent-fg)",
            }}
          >
            {user.name?.[0] || user.email?.[0] || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: "var(--nav-fg)" }}
            >
              {user.name || user.email}
            </p>
            <p
              className="text-xs capitalize opacity-60"
              style={{ color: "var(--nav-fg)" }}
            >
              {user.role.replace("_", " ").toLowerCase()}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-1.5 rounded opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: "var(--nav-fg)" }}
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
      <div
        className="nav-chrome lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 border-b"
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 -ml-1.5 rounded-lg opacity-70 hover:opacity-100"
          style={{ color: "var(--nav-fg)" }}
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
          <HardHat className="w-6 h-6" style={{ color: "var(--nav-accent)" }} />
        )}
        <span
          className="text-base font-bold truncate"
          style={{ color: "var(--nav-fg)", fontFamily: "var(--font-oswald, inherit)" }}
        >
          {companyName || "AccuDone"}
        </span>
        {unreadCount > 0 && (
          <Link
            href="/dashboard/notifications"
            className="ml-auto relative p-1.5"
          >
            <Bell className="w-5 h-5" style={{ color: "var(--nav-fg)" }} />
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] font-bold rounded-full flex items-center justify-center"
              style={{
                backgroundColor: "var(--nav-accent)",
                color: "var(--nav-accent-fg)",
              }}
            >
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
          "nav-chrome lg:hidden fixed inset-y-0 left-0 z-50 w-72 shadow-xl flex flex-col transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar — always visible on lg+ */}
      <div className="nav-chrome hidden lg:flex lg:flex-col w-64 border-r shrink-0">
        {sidebarContent}
      </div>

      {/* Global search palette */}
      <SearchPalette />

      {/* Mobile bottom tab bar */}
      <div className="nav-chrome lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center border-t safe-area-inset-bottom">
        {navigation.slice(0, 4).map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-opacity relative"
              style={{
                color: isActive ? "var(--nav-accent)" : "var(--nav-fg)",
                opacity: isActive ? 1 : 0.6,
              }}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
              {item.href === "/dashboard/notifications" && unreadCount > 0 && (
                <span
                  className="absolute top-1.5 right-[calc(50%-14px)] w-4 h-4 text-[9px] font-bold rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--nav-accent)",
                    color: "var(--nav-accent-fg)",
                  }}
                >
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
