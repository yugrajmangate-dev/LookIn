"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Trash2,
  GraduationCap,
  Users,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  UserMinus,
  Info,
  Search,
  BookOpen,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import {
  apiUrl,
  type EnrolledStudentsListResponse,
  type EnrolledStudentSummary,
  type AlumniCleanupRequest,
  type AlumniCleanupResult,
  type DeleteStudentResponse,
  type ErrorResponse,
} from "@/lib/api";

export default function AdminPage(): React.JSX.Element {
  /* ── Enrolled students state ─────────────────────────── */
  const [students, setStudents] = useState<EnrolledStudentSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  /* ── Delete state ────────────────────────────────────── */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /* ── Alumni cleanup state ────────────────────────────── */
  const [cutoffYear, setCutoffYear] = useState<string>(
    String(new Date().getFullYear())
  );
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<AlumniCleanupResult | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);

  /* ── Fetch enrolled students ─────────────────────────── */
  const fetchStudents = useCallback(async () => {
    setIsLoadingStudents(true);
    setStudentsError(null);
    setDeleteSuccess(null);
    setDeleteError(null);

    try {
      const response = await fetch(apiUrl("/api/enroll/list"));
      if (!response.ok) {
        const body: ErrorResponse = await response.json();
        throw new Error(body.detail ?? body.error);
      }
      const data: EnrolledStudentsListResponse = await response.json();
      setStudents(data.students);
      setTotalCount(data.total_count);
    } catch (err) {
      setStudentsError(
        err instanceof Error ? err.message : "Failed to load enrolled students."
      );
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  /* ── Delete a student ────────────────────────────────── */
  const handleDelete = useCallback(
    async (studentId: string) => {
      setDeletingId(studentId);
      setDeleteSuccess(null);
      setDeleteError(null);
      setConfirmDeleteId(null);

      try {
        const response = await fetch(apiUrl(`/api/enroll/${studentId}`), {
          method: "DELETE",
        });
        if (!response.ok) {
          const body: ErrorResponse = await response.json();
          throw new Error(body.detail ?? body.error);
        }
        const data: DeleteStudentResponse = await response.json();
        setDeleteSuccess(data.message);
        setStudents((prev) => prev.filter((s) => s.student_id !== studentId));
        setTotalCount((prev) => prev - 1);
      } catch (err) {
        setDeleteError(
          err instanceof Error ? err.message : "Failed to delete student."
        );
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  /* ── Alumni cleanup ──────────────────────────────────── */
  const handleCleanup = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setCleanupResult(null);
      setCleanupError(null);

      const yearNum = parseInt(cutoffYear, 10);
      if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        setCleanupError("Please enter a valid year between 2000 and 2100.");
        return;
      }

      setIsRunningCleanup(true);

      try {
        const payload: AlumniCleanupRequest = {
          graduation_year_cutoff: yearNum,
        };
        const response = await fetch(apiUrl("/api/admin/alumni-cleanup"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const body: ErrorResponse = await response.json();
          throw new Error(body.detail ?? body.error);
        }
        const data: AlumniCleanupResult = await response.json();
        setCleanupResult(data);
        // Refresh the enrolled students list
        fetchStudents();
      } catch (err) {
        setCleanupError(
          err instanceof Error ? err.message : "Alumni cleanup failed."
        );
      } finally {
        setIsRunningCleanup(false);
      }
    },
    [cutoffYear, fetchStudents]
  );

  /* ── Filtered students ───────────────────────────────── */
  const filteredStudents = students.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.student_name.toLowerCase().includes(q) ||
      s.student_id.toLowerCase().includes(q) ||
      (s.division ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        title="Student Database"
        description="Manage student profiles, attendance status, and enrollment records."
      >
        <Link href="/enroll" className="btn-primary">
          Enroll Student
        </Link>
        <button
          type="button"
          onClick={fetchStudents}
          disabled={isLoadingStudents}
          className="btn-secondary"
          aria-label="Refresh student list"
        >
          <RefreshCw className={`h-4 w-4 ${isLoadingStudents ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </PageHeader>

      {/* ── Success / Error banners ───────────────────── */}
      {deleteSuccess && (
        <div className="alert-success mb-4 animate-fade-in sm:mb-6">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-800">{deleteSuccess}</p>
        </div>
      )}
      {deleteError && (
        <div className="alert-error mb-4 animate-fade-in sm:mb-6">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{deleteError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* ══════════════════════════════════════════════
            LEFT: Enrolled Students List (2/3 width)
        ══════════════════════════════════════════════ */}
        <div className="xl:col-span-2">
          <div className="card-elevated overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
                  <Users className="h-5 w-5 text-brand-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Student Database
                  </h2>
                  <p className="text-xs text-gray-500">
                    {totalCount} student{totalCount !== 1 ? "s" : ""} registered
                  </p>
                </div>
              </div>

              {/* Search */}
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search…"
                  className="input-field pl-9 py-2 text-sm w-48"
                />
              </div>
            </div>

            {/* Mobile search */}
            <div className="border-b border-gray-100 px-4 py-2.5 sm:hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search students…"
                  className="input-field pl-9 py-2 text-sm w-full"
                />
              </div>
            </div>

            {/* Loading */}
            {isLoadingStudents && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-brand-400" />
                <p className="text-sm font-medium text-gray-500">Loading students…</p>
              </div>
            )}

            {/* Error */}
            {studentsError && !isLoadingStudents && (
              <div className="m-4 alert-error">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{studentsError}</p>
              </div>
            )}

            {/* Empty */}
            {!isLoadingStudents && !studentsError && students.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                  <Users className="h-8 w-8 text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-500">
                  No students enrolled yet
                </p>
                <p className="mt-1.5 text-xs text-gray-400 max-w-xs text-center">
                  Use the Enroll Student page to register students with face photos.
                </p>
              </div>
            )}

            {/* Student table */}
            {!isLoadingStudents && filteredStudents.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                        Student
                      </th>
                      <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">
                        Department
                      </th>
                      <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">
                        Attendance %
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStudents.map((student, idx) => (
                      <tr
                        key={student.student_id}
                        className="transition-colors hover:bg-gray-50/60 animate-fade-in"
                        style={{ animationDelay: `${idx * 0.02}s` }}
                      >
                        <td className="px-4 py-3 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 flex-shrink-0">
                              {student.student_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-gray-900">
                                {student.student_name}
                              </p>
                              <p className="truncate text-xs text-gray-500 font-mono">
                                {student.student_id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                            {student.division ?? "—"}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            —
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right sm:px-6">
                          {confirmDeleteId === student.student_id ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleDelete(student.student_id)}
                                disabled={deletingId === student.student_id}
                                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                              >
                                {deletingId === student.student_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Confirm"
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                setConfirmDeleteId(student.student_id)
                              }
                              disabled={deletingId === student.student_id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-all hover:bg-red-100 hover:border-red-300 disabled:opacity-50"
                              title="Remove student"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Remove</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            RIGHT: Alumni Cleanup (1/3 width)
        ══════════════════════════════════════════════ */}
        <div className="space-y-4">
          {/* Alumni Cleanup Card */}
          <div className="card-elevated overflow-hidden">
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
                <GraduationCap className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Alumni Cleanup
                </h2>
                <p className="text-xs text-gray-500">Remove graduated students</p>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {/* Info */}
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Removes all biometric data for students whose graduation year
                  is <strong>≤</strong> the cutoff. Students without a
                  graduation year are retained.
                </p>
              </div>

              <form onSubmit={handleCleanup} className="space-y-4">
                <div>
                  <label
                    htmlFor="cutoff-year"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Graduation Year Cutoff
                  </label>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    <input
                      id="cutoff-year"
                      type="number"
                      min={2000}
                      max={2100}
                      required
                      value={cutoffYear}
                      onChange={(e) => setCutoffYear(e.target.value)}
                      placeholder="e.g. 2025"
                      className="input-field flex-1"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Removes anyone who graduated in {cutoffYear || "…"} or
                    earlier.
                  </p>
                </div>

                {cleanupError && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 animate-fade-in">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                    <p className="text-xs text-red-700">{cleanupError}</p>
                  </div>
                )}

                {cleanupResult && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 animate-fade-in">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                    <div className="text-xs text-emerald-800">
                      <p className="font-semibold">{cleanupResult.message}</p>
                      {cleanupResult.removed_count > 0 && (
                        <p className="mt-0.5">
                          Removed: {cleanupResult.removed_count} student
                          {cleanupResult.removed_count !== 1 ? "s" : ""} (
                          {cleanupResult.removed_student_ids.join(", ")})
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isRunningCleanup}
                  className="btn-danger w-full"
                >
                  {isRunningCleanup ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Running…
                    </>
                  ) : (
                    <>
                      <UserMinus className="h-4 w-4" />
                      Run Cleanup
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Security notice */}
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Deletion of biometric data is <strong>permanent</strong> and
              cannot be undone. All face encodings for removed students will be
              lost.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
