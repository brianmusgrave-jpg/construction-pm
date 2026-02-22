"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  HardHat,
  LayoutDashboard,
  LogOut,
  FileText,
  Camera,
  Bell,
  BarChart3,
} from "lucide-react";

interface ContractorNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: string;
  };
  logoUrl?: string | null;
  companyName?: string | null;
  unreadCount?: number;
}

const navigation = [
  { name: "My Work", href: "/contractor", icon: LayoutDashboard },
  { name: "Documents", href: "/contractor/documents", icon: FileText },
  { name: "Photos", href: "/contractor/photos", icon: Camera },
  { name: "Reports", href: "/contractor/reports", icon: BarChart3 },
  { name: "Notifications", href: "/contractor/notifications", icon: Bell },
];

export function ContractorNav({
  user,
  logoUrl,
  companyName,
  unreadCount = 0,
}: ContractorNavProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    return (
      pathname === href ||
      (href !== "/contractor" && pathname.startsWith(href))
    );
  }

  return (
    <>
      {/* Desktop top nav — visible on sm+ */}
      <header className="hidden sm:block bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link
              href="/contractor"
              className="flex items-center gap-2 shrink-0"
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={companyName || "Logo"}
                  className="w-6 h-6 rounded object-contain"
                />
              ) : (
                <HardHat className="w-6 h-6 text-[var(--color-primary)]" />
              )}
              <span className="text-base font-bold text-gray-900">
                {companyName || "Contractor Portal"}
              </span>
            </Link>

            {/* Nav links */}
            <nav className="flex items-center gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-[var(--color-primary-bg)] text-[var(--color-primary-dark)]"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                  {item.name === "Notifications" && unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-[var(--color-primary)] text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            {/* User */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 leading-tight">
                  {user.name || user.email}
                </p>
                <p className="text-xs text-[var(--color-primary)]">
                  Contractor
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary-bg)] flex items-center justify-center text-[var(--color-primary-dark)] text-sm font-medium">
                {user.name?.[0] || user.email?.[0] || "?"}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile top bar — logo + user avatar + sign out */}
      <header className="sm:hidden bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 h-12">
          <Link
            href="/contractor"
            className="flex items-center gap-2"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName || "Logo"}
                className="w-5 h-5 rounded object-contain"
              />
            ) : (
              <HardHat className="w-5 h-5 text-[var(--color-primary)]" />
            )}
            <span className="text-sm font-bold text-gray-900">
              {companyName || "Construction PM"}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[var(--color-primary-bg)] flex items-center justify-center text-[var(--color-primary-dark)] text-xs font-medium">
              {user.name?.[0] || user.email?.[0] || "?"}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-14">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors relative",
                isActive(item.href)
                  ? "text-[var(--color-primary)]"
                  : "text-gray-400"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
              {item.name === "Notifications" && unreadCount > 0 && (
                <span className="absolute -top-0.5 right-0 w-4 h-4 bg-[var(--color-primary)] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
