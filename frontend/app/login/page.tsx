"use client";

import React, { useState, type FormEvent } from "react";
import {
  ScanFace,
  LogIn,
  AlertCircle,
  Loader2,
  GraduationCap,
} from "lucide-react";
import { useAuth, type UserRole } from "@/components/AuthProvider";

export default function LoginPage(): React.JSX.Element {
  const { loginAdmin, loginStudent } = useAuth();

  const [role, setRole] = useState<UserRole>("admin");
  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (role === "admin") {
      const result = loginAdmin(identifier, password);
      if (result) {
        setError(result);
        setIsSubmitting(false);
      }
      // On success the AuthProvider flips isAuthenticated → layout re-renders
    } else {
      // Student login — just needs student_id
      const result = await loginStudent(identifier);
      if (result) {
        setError(result);
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      {/* Background decorative blobs */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-80 w-80 rounded-full bg-brand-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" />

      <div className="w-full max-w-md animate-fade-in">
        {/* ── Brand Card ─────────────────────────────── */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-md sm:rounded-3xl sm:p-8 md:p-10">
          {/* Logo */}
          <div className="mb-7 flex flex-col items-center gap-3 sm:mb-10 sm:gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-600/30 animate-scale-in sm:h-[4.5rem] sm:w-[4.5rem]">
              <ScanFace className="h-8 w-8 text-white sm:h-10 sm:w-10" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">LookIn</h1>
              <p className="mt-1 text-xs text-gray-400 sm:mt-1.5 sm:text-sm">
                Smart Attendance System
              </p>
            </div>
          </div>

          {/* Role Toggle */}
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Log In As
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setRole("admin");
                  setError(null);
                  setIdentifier("");
                  setPassword("");
                }}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                  role === "admin"
                    ? "bg-slate-800 text-white shadow-lg"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                }`}
              >
                Admin / Faculty
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole("student");
                  setError(null);
                  setIdentifier("");
                  setPassword("");
                }}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                  role === "student"
                    ? "bg-slate-800 text-white shadow-lg"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                }`}
              >
                Student
              </button>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email / ID field */}
            <div>
              <label
                htmlFor="identifier"
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                {role === "admin" ? "Username" : "Student ID (Roll Number)"}
              </label>
              <input
                id="identifier"
                type="text"
                required
                autoComplete={role === "admin" ? "username" : "off"}
                autoFocus
                placeholder={role === "admin" ? "Enter your username" : "Enter your roll number"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-500 transition-all focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20"
              />
            </div>

            {/* Password (only for admin) */}
            {role === "admin" && (
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-gray-300"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-500 transition-all focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20"
                />
              </div>
            )}

            {/* Student info badge */}
            {role === "student" && (
              <div className="flex items-center gap-2 rounded-xl border border-brand-500/20 bg-brand-500/10 px-3 py-2">
                <GraduationCap className="h-4 w-4 flex-shrink-0 text-brand-400" />
                <p className="text-xs leading-relaxed text-brand-300/90">
                  Enter your registered roll number to view your attendance records.
                </p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 animate-fade-in">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:shadow-xl hover:shadow-brand-600/30 hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {role === "admin" ? "Logging in…" : "Verifying…"}
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Log In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-gray-600">
          &copy; 2026 LookIn — I2IT Attendance System
        </p>
        <p className="mt-1 text-center text-[10px] text-gray-700">v2.2</p>
      </div>
    </div>
  );
}
