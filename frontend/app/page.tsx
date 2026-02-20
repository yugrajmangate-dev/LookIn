"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CalendarDays,
  RefreshCw,
  Users,
  PenLine,
  CheckCircle2,
  AlertCircle,
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

  /* ── Manual override state ───────────────────── */
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

  return (
    <div>
      <PageHeader
        title="Daily Roster"
        description="View attendance records for the selected date."
      >
        {/* Date picker */}
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="input-field w-44"
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
          Refresh
        </button>
      </PageHeader>

      {/* Summary Card */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-5 py-3">
        <Users className="h-5 w-5 text-brand-600" />
        <span className="text-sm font-medium text-brand-800">
          {totalRecords} student{totalRecords !== 1 ? "s" : ""} recorded for{" "}
          {selectedDate}
        </span>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/60">
                <th className="px-6 py-3.5 font-semibold text-gray-600">
                  #
                </th>
                <th className="px-6 py-3.5 font-semibold text-gray-600">
                  Student ID
                </th>
                <th className="px-6 py-3.5 font-semibold text-gray-600">
                  Name
                </th>
                <th className="px-6 py-3.5 font-semibold text-gray-600">
                  Division
                </th>
                <th className="px-6 py-3.5 font-semibold text-gray-600">
                  Time
                </th>
                <th className="px-6 py-3.5 font-semibold text-gray-600">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-16 text-center text-gray-400"
                  >
                    <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin" />
                    Loading roster…
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-16 text-center text-gray-400"
                  >
                    No attendance records found for {selectedDate}.
                  </td>
                </tr>
              ) : (
                records.map((record, index) => (
                  <tr
                    key={`${record.student_id}-${record.time}`}
                    className="transition-colors hover:bg-gray-50/50"
                  >
                    <td className="px-6 py-4 text-gray-400">{index + 1}</td>
                    <td className="px-6 py-4 font-mono text-xs font-medium text-gray-700">
                      {record.student_id}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {record.student_name}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {record.division ?? "—"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">
                      {record.time}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={record.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Manual Attendance Override ────────────── */}
      <div className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <PenLine className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-800">
            Manual Attendance Entry
          </h2>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Manually mark a student present or absent for{" "}
          <strong>{selectedDate}</strong>. If a record already exists for
          this student on the selected date, its status will be updated.
        </p>

        {/* Override Success */}
        {overrideSuccess && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 animate-fadeIn">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
            <p className="text-sm text-emerald-800">{overrideSuccess}</p>
          </div>
        )}

        {/* Override Error */}
        {overrideError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3 animate-fadeIn">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{overrideError}</p>
          </div>
        )}

        <form
          onSubmit={handleOverrideSubmit}
          className="card grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          {/* Student ID */}
          <div>
            <label
              htmlFor="overrideStudentId"
              className="mb-1 block text-xs font-medium text-gray-600"
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
              className="mb-1 block text-xs font-medium text-gray-600"
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
              className="mb-1 block text-xs font-medium text-gray-600"
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
              className="mb-1 block text-xs font-medium text-gray-600"
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
  );
}
