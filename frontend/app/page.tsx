"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CalendarDays,
  RefreshCw,
  Users,
  PenLine,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  UserX,
  Clock,
  Search,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import {
  apiUrl,
  type AttendanceRecord,
  type DailyRosterResponse,
  type ManualOverrideRequest,
  type ManualOverrideResponse,
  type ErrorResponse,
} from "@/lib/api";

/** Return today's date as YYYY-MM-DD */
function todayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

export default function DailyRosterPage(): React.JSX.Element {
  /* ── Roster state ────────────────────────────── */
  const [selectedDate, setSelectedDate] = useState<string>(todayDateString());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  /* ── Manual override state ───────────────────── */
  const [showOverride, setShowOverride] = useState<boolean>(false);
  const [overrideStudentId, setOverrideStudentId] = useState<string>("");
  const [overrideStudentName, setOverrideStudentName] = useState<string>("");
  const [overrideDivision, setOverrideDivision] = useState<string>("");
  const [overrideStatus, setOverrideStatus] = useState<"present" | "absent">(
    "present"
  );
  const [isSubmittingOverride, setIsSubmittingOverride] =
    useState<boolean>(false);
  const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  /* ── Fetch roster ────────────────────────────── */
  const fetchRoster = useCallback(async (dateValue: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        apiUrl(`/api/attendance/daily-roster?date=${dateValue}`)
      );

      if (!response.ok) {
        const errorBody: ErrorResponse = await response.json();
        throw new Error(errorBody.detail ?? errorBody.error);
      }

      const data: DailyRosterResponse = await response.json();
      setRecords(data.records);
      setTotalRecords(data.total_records);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to fetch the daily roster.";
      setErrorMessage(message);
      setRecords([]);
      setTotalRecords(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoster(selectedDate);
  }, [selectedDate, fetchRoster]);

  const handleDateChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    setSelectedDate(event.target.value);
  };

  const handleRefresh = (): void => {
    fetchRoster(selectedDate);
  };

  /* ── Computed stats ──────────────────────────── */
  const presentCount = records.filter(
    (r) => r.status.toLowerCase() === "present"
  ).length;
  const absentCount = records.filter(
    (r) => r.status.toLowerCase() === "absent"
  ).length;

  /* ── Search/filter ───────────────────────────── */
  const filteredRecords = records.filter((record) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      record.student_name.toLowerCase().includes(query) ||
      record.student_id.toLowerCase().includes(query) ||
      (record.division ?? "").toLowerCase().includes(query)
    );
  });

  /* ── Manual override submit ──────────────────── */
  const handleOverrideSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setOverrideSuccess(null);
      setOverrideError(null);

      if (!overrideStudentId.trim() || !overrideStudentName.trim()) {
        setOverrideError("Student ID and Name are required.");
        return;
      }

      setIsSubmittingOverride(true);

      try {
        const payload: ManualOverrideRequest = {
          student_id: overrideStudentId.trim(),
          student_name: overrideStudentName.trim(),
          division: overrideDivision.trim() || null,
          date: selectedDate,
          status: overrideStatus,
        };

        const response = await fetch(apiUrl("/api/attendance/manual-override"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorBody: ErrorResponse = await response.json();
          throw new Error(errorBody.detail ?? errorBody.error);
        }

        const data: ManualOverrideResponse = await response.json();
        setOverrideSuccess(data.message);

        // Reset form
        setOverrideStudentId("");
        setOverrideStudentName("");
        setOverrideDivision("");
        setOverrideStatus("present");

        // Refresh the roster to show the new/updated record
        fetchRoster(selectedDate);
      } catch (submitError) {
        const message =
          submitError instanceof Error
            ? submitError.message
            : "Manual override failed. Please try again.";
        setOverrideError(message);
      } finally {
        setIsSubmittingOverride(false);
      }
    },
    [
      overrideStudentId,
      overrideStudentName,
      overrideDivision,
      overrideStatus,
      selectedDate,
      fetchRoster,
    ]
  );

  /* ── Format date for display ─────────────────── */
  const formatDisplayDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      <PageHeader
        title="Daily Roster"
        description="View and manage attendance records for the selected date."
      >
        {/* Date picker */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-2.5 py-1.5 shadow-sm sm:px-3">
          <CalendarDays className="h-4 w-4 text-gray-400 hidden sm:block" />
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="border-none bg-transparent text-sm font-medium text-gray-700 focus:outline-none w-[130px] sm:w-36"
            aria-label="Select date"
          />
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="btn-secondary"
          aria-label="Refresh roster"
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </PageHeader>

      {/* ── Date Display ───────────────────────────── */}
      <p className="mb-4 text-xs text-gray-500 sm:mb-6 sm:text-sm">
        Showing records for <span className="font-medium text-gray-700">{formatDisplayDate(selectedDate)}</span>
      </p>

      {/* ── Stats Cards ────────────────────────────── */}
      <div className="mb-4 grid grid-cols-3 gap-2 sm:mb-6 sm:gap-4">
        <div className="stat-card animate-fade-in">
          <div className="stat-icon bg-brand-50 !h-9 !w-9 sm:!h-12 sm:!w-12">
            <Users className="h-4 w-4 text-brand-600 sm:h-6 sm:w-6" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 sm:text-2xl">{totalRecords}</p>
            <p className="text-[10px] font-medium text-gray-500 sm:text-xs">Total</p>
          </div>
        </div>

        <div className="stat-card animate-fade-in" style={{ animationDelay: "0.05s" }}>
          <div className="stat-icon bg-emerald-50 !h-9 !w-9 sm:!h-12 sm:!w-12">
            <UserCheck className="h-4 w-4 text-emerald-600 sm:h-6 sm:w-6" />
          </div>
          <div>
            <p className="text-lg font-bold text-emerald-600 sm:text-2xl">{presentCount}</p>
            <p className="text-[10px] font-medium text-gray-500 sm:text-xs">Present</p>
          </div>
        </div>

        <div className="stat-card animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="stat-icon bg-red-50 !h-9 !w-9 sm:!h-12 sm:!w-12">
            <UserX className="h-4 w-4 text-red-500 sm:h-6 sm:w-6" />
          </div>
          <div>
            <p className="text-lg font-bold text-red-500 sm:text-2xl">{absentCount}</p>
            <p className="text-[10px] font-medium text-gray-500 sm:text-xs">Absent</p>
          </div>
        </div>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="alert-error mb-6 animate-fade-in">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-700">
            <strong>Error:</strong> {errorMessage}
          </p>
        </div>
      )}

      {/* ── Search & Actions Bar ───────────────────── */}
      <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID…"
            className="input-field pl-10 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowOverride(!showOverride)}
          className={showOverride ? "btn-primary" : "btn-secondary"}
        >
          <PenLine className="h-4 w-4" />
          Manual Entry
        </button>
      </div>

      {/* ── Attendance Table (desktop) / Cards (mobile) ── */}
      <div className="animate-fade-in">
        {/* Loading State */}
        {isLoading && (
          <div className="card-elevated flex flex-col items-center justify-center py-16 sm:py-20">
            <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin text-brand-400" />
            <p className="text-sm font-medium text-gray-400">Loading roster…</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredRecords.length === 0 && (
          <div className="card-elevated flex flex-col items-center justify-center py-16 sm:py-20">
            <Users className="mx-auto mb-3 h-10 w-10 text-gray-200" />
            <p className="text-sm font-medium text-gray-400">
              {searchQuery
                ? "No matching records found"
                : `No attendance records for ${selectedDate}`}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {searchQuery
                ? "Try a different search term"
                : "Upload a class video or add a manual entry"}
            </p>
          </div>
        )}

        {/* Mobile Card View */}
        {!isLoading && filteredRecords.length > 0 && (
          <div className="space-y-2 md:hidden">
            {filteredRecords.map((record, index) => (
              <div
                key={`${record.student_id}-${record.time}-m`}
                className="card px-4 py-3 flex items-center gap-3"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{record.student_name}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500">
                    <span className="font-mono font-medium text-gray-600">{record.student_id}</span>
                    {record.division && <span>· {record.division}</span>}
                    <span className="inline-flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{record.time}</span>
                  </div>
                </div>
                <StatusBadge status={record.status} />
              </div>
            ))}
          </div>
        )}

        {/* Desktop Table View */}
        {!isLoading && filteredRecords.length > 0 && (
          <div className="card-elevated overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80">
                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider lg:px-6 lg:py-4">#</th>
                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider lg:px-6 lg:py-4">Student ID</th>
                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider lg:px-6 lg:py-4">Name</th>
                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider lg:px-6 lg:py-4">Division</th>
                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider lg:px-6 lg:py-4">Time</th>
                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider lg:px-6 lg:py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredRecords.map((record, index) => (
                    <tr
                      key={`${record.student_id}-${record.time}`}
                      className="transition-colors hover:bg-gray-50/80"
                    >
                      <td className="px-4 py-3 text-gray-400 font-medium lg:px-6 lg:py-4">{index + 1}</td>
                      <td className="px-4 py-3 lg:px-6 lg:py-4">
                        <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1 font-mono text-xs font-semibold text-gray-700">
                          {record.student_id}
                        </span>
                      </td>
                      <td className="px-4 py-3 lg:px-6 lg:py-4">
                        <p className="font-semibold text-gray-900">{record.student_name}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 lg:px-6 lg:py-4">
                        {record.division ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 lg:px-6 lg:py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {record.time}
                        </span>
                      </td>
                      <td className="px-4 py-3 lg:px-6 lg:py-4">
                        <StatusBadge status={record.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2.5 lg:px-6 lg:py-3">
              <p className="text-xs text-gray-500">
                Showing {filteredRecords.length} of {totalRecords} records
                {searchQuery && <span> matching &ldquo;{searchQuery}&rdquo;</span>}
              </p>
            </div>
          </div>
        )}

        {/* Mobile Footer */}
        {!isLoading && filteredRecords.length > 0 && (
          <div className="mt-2 md:hidden">
            <p className="text-center text-[11px] text-gray-400">
              {filteredRecords.length} of {totalRecords} records
              {searchQuery && <span> matching “{searchQuery}”</span>}
            </p>
          </div>
        )}
      </div>

      {/* ── Manual Attendance Override ────────────── */}
      {showOverride && (
        <div className="mt-6 animate-slide-up sm:mt-8">
          <div className="card-elevated overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex items-center gap-2">
                <PenLine className="h-4 w-4 text-gray-500 sm:h-5 sm:w-5" />
                <h2 className="text-sm font-semibold text-gray-800 sm:text-base">
                  Manual Attendance Entry
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-gray-500 sm:mt-1 sm:text-sm">
                Mark a student for{" "}
                <strong>{formatDisplayDate(selectedDate)}</strong>
              </p>
            </div>

            <div className="p-4 sm:p-6">
              {/* Override Success */}
              {overrideSuccess && (
                <div className="alert-success mb-4 animate-fade-in sm:mb-5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
                  <p className="text-sm text-emerald-800">{overrideSuccess}</p>
                </div>
              )}

              {/* Override Error */}
              {overrideError && (
                <div className="alert-error mb-4 animate-fade-in sm:mb-5">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                  <p className="text-sm text-red-700">{overrideError}</p>
                </div>
              )}

              <form
                onSubmit={handleOverrideSubmit}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5"
              >
                {/* Student ID */}
                <div>
                  <label
                    htmlFor="overrideStudentId"
                    className="mb-1.5 block text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    Student ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="overrideStudentId"
                    type="text"
                    value={overrideStudentId}
                    onChange={(e) => setOverrideStudentId(e.target.value)}
                    placeholder="STU-2025-0042"
                    required
                    className="input-field"
                  />
                </div>

                {/* Student Name */}
                <div>
                  <label
                    htmlFor="overrideStudentName"
                    className="mb-1.5 block text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="overrideStudentName"
                    type="text"
                    value={overrideStudentName}
                    onChange={(e) => setOverrideStudentName(e.target.value)}
                    placeholder="Priya Sharma"
                    required
                    className="input-field"
                  />
                </div>

                {/* Division */}
                <div>
                  <label
                    htmlFor="overrideDivision"
                    className="mb-1.5 block text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    Division
                  </label>
                  <input
                    id="overrideDivision"
                    type="text"
                    value={overrideDivision}
                    onChange={(e) => setOverrideDivision(e.target.value)}
                    placeholder="CS-A"
                    className="input-field"
                  />
                </div>

                {/* Status */}
                <div>
                  <label
                    htmlFor="overrideStatus"
                    className="mb-1.5 block text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    Status
                  </label>
                  <select
                    id="overrideStatus"
                    value={overrideStatus}
                    onChange={(e) =>
                      setOverrideStatus(e.target.value as "present" | "absent")
                    }
                    className="input-field"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>

                {/* Submit */}
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isSubmittingOverride}
                    className="btn-primary w-full justify-center"
                  >
                    {isSubmittingOverride ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <PenLine className="h-4 w-4" />
                        Submit
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
