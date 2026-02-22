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
} from "lucide-react";

interface ContractorNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: string;
  };
}

const navigation = [
  { name: "My Work", href: "/contractor", icon: LayoutDashboard },
  { name: "Documents", href: "/contractor/documents", icon: FileText },
  { name: "Photos", href: "/contractor/photos", icon: Camera },
];

export function ContractorNav({ user }: ContractorNavProps) {
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
            <HardHat className="w-6 h-6 text-orange-500" />
            <span className="text-base font-bold text-gray-900 hidden sm:block">
              Contractor Portal
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
                      ? "bg-orange-50 text-orange-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.name}</span>
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
              <p className="text-xs text-orange-600">Contractor</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 text-sm font-medium">
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
