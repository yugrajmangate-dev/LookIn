"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import Sidebar from "@/components/Sidebar";
import LoginPage from "@/app/login/page";

/**
 * Inner shell that reads auth state and renders either the login screen
 * or the main dashboard layout with sidebar.
 */
function AuthGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();

  /* ── Show a centered spinner while restoring session ── */
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  /* ── Not authenticated → show login ────────────────── */
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  /* ── Authenticated → normal app layout ─────────────── */
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      {/* pt-14 on mobile accounts for the fixed mobile header bar; lg:pt-0 removes it on desktop */}
      <main className="flex-1 pt-14 lg:pt-0 lg:ml-72 animate-fade-in">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * Top-level client shell rendered inside `<body>`.
 * Wraps the whole app in `AuthProvider` so every component can call `useAuth()`.
 */
export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
