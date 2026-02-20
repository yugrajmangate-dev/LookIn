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
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-64 flex-1 p-6 lg:p-10 animate-fade-in">
        {children}
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
