"use client";

import React, { useState, useEffect } from "react";
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
  ChevronRight,
  Menu,
  X,
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
  description: string;
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: "Daily Roster",
    href: "/",
    icon: LayoutDashboard,
    description: "Attendance records",
  },
  {
    label: "Upload Video",
    href: "/upload",
    icon: UploadCloud,
    description: "Process class videos",
  },
  {
    label: "Unknown Faces",
    href: "/review",
    icon: UserSearch,
    description: "Review detections",
  },
  {
    label: "Enroll Student",
    href: "/enroll",
    icon: UserPlus,
    description: "Register new faces",
  },
];

export default function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

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
      {/* ── Brand Header ─────────────────────────────── */}
      <div className="flex h-16 items-center gap-3 border-b border-white/[0.06] px-5 lg:h-20 lg:px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-600/20 lg:h-11 lg:w-11">
          <ScanFace className="h-5 w-5 text-white lg:h-6 lg:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-base font-bold tracking-tight lg:text-lg">LookIn</span>
          <p className="text-[10px] font-medium text-slate-400 lg:text-[11px]">Attendance System</p>
        </div>
        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── Navigation Links ─────────────────────────── */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 lg:py-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 lg:mb-3 lg:text-[11px]">
          Navigation
        </p>
        {NAVIGATION_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 lg:py-3",
                isActive
                  ? "bg-gradient-to-r from-brand-600/90 to-brand-700/80 text-white shadow-lg shadow-brand-600/20"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors lg:h-9 lg:w-9",
                  isActive
                    ? "bg-white/20"
                    : "bg-white/[0.04] group-hover:bg-white/[0.08]"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0 lg:h-[18px] lg:w-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate">{item.label}</p>
                <p
                  className={cn(
                    "hidden truncate text-[11px] font-normal sm:block",
                    isActive ? "text-white/70" : "text-slate-500"
                  )}
                >
                  {item.description}
                </p>
              </div>
              {isActive && (
                <ChevronRight className="h-4 w-4 text-white/50" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer with Logout ────────────────────────── */}
      <div className="border-t border-white/[0.06] px-3 py-3 space-y-2 lg:py-4 lg:space-y-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 lg:py-3"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] lg:h-9 lg:w-9">
            <LogOut className="h-4 w-4 flex-shrink-0 lg:h-[18px] lg:w-[18px]" />
          </div>
          Sign Out
        </button>
        <p className="px-3 text-[10px] text-slate-600 lg:text-[11px]">
          &copy; 2025 LookIn &middot; I2IT
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile hamburger button (top bar) ──────────── */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700">
            <ScanFace className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-gray-900">LookIn</span>
        </div>
      </div>

      {/* ── Mobile overlay ─────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar panel ──────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white transition-transform duration-300 ease-in-out lg:z-30 lg:w-72 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
