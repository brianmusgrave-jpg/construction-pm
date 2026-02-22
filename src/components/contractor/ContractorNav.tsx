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
  { name: "Notifications", href: "/contractor/notifications", icon: Bell },
];

export function ContractorNav({ user, logoUrl, companyName, unreadCount = 0 }: ContractorNavProps) {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link
            href="/contractor"
            className="flex items-center gap-2 shrink-0"
          >
            {logoUrl ? (
              <img src={logoUrl} alt={companyName || "Logo"} className="w-6 h-6 rounded object-contain" />
            ) : (
              <HardHat className="w-6 h-6 text-[var(--color-primary)]" />
            )}
            <span className="text-base font-bold text-gray-900 hidden sm:block">
              {companyName || "Contractor Portal"}
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/contractor" &&
                  pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[var(--color-primary-bg)] text-[var(--color-primary-dark)]"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.name}</span>
                  {item.name === "Notifications" && unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-[var(--color-primary)] text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900 leading-tight">
                {user.name || user.email}
              </p>
              <p className="text-xs text-[var(--color-primary)]">Contractor</p>
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
  );
}
