"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  LayoutDashboard,
  UploadCloud,
  UserSearch,
  UserPlus,
  ScanFace,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

/** Utility to merge Tailwind classes safely. */
function cn(...inputs: (string | undefined | false | null)[]): string {
  return twMerge(clsx(inputs));
}

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: "Daily Roster",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Upload Video",
    href: "/upload",
    icon: UploadCloud,
  },
  {
    label: "Unknown Faces",
    href: "/review",
    icon: UserSearch,
  },
  {
    label: "Enroll Student",
    href: "/enroll",
    icon: UserPlus,
  },
];

export default function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar text-white">
      {/* ── Brand Header ─────────────────────────────── */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
        <ScanFace className="h-8 w-8 text-brand-400" />
        <span className="text-lg font-bold tracking-tight">LookIn</span>
      </div>

      {/* ── Navigation Links ─────────────────────────── */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAVIGATION_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-active text-white"
                  : "text-gray-300 hover:bg-sidebar-hover hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer with Logout ────────────────────────── */}
      <div className="border-t border-white/10 px-3 py-4 space-y-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-red-600/20 hover:text-red-300"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          Sign Out
        </button>
        <p className="px-3 text-xs text-gray-500">
          &copy; 2026 LookIn
        </p>
      </div>
    </aside>
  );
}
