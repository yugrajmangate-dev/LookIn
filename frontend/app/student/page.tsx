"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  GraduationCap,
  CalendarDays,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Loader2,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { apiUrl, type AttendanceRecord } from "@/lib/api";

interface StudentAttendanceResponse {
  success: boolean;
  student_id: string;
  student_name: string;
  division: string | null;
  total_records: number;
  present_count: number;
  absent_count: number;
  attendance_percentage: number;
  records: AttendanceRecord[];
}

const RECORDS_PER_PAGE = 10;

export default function StudentDashboard(): React.JSX.Element {
  const { studentInfo } = useAuth();
  const [data, setData] = useState<StudentAttendanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!studentInfo?.student_id) return;

    const fetchAttendance = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          apiUrl(`/api/attendance/student/${encodeURIComponent(studentInfo.student_id)}`)
        );

        if (!response.ok) {
          throw new Error("Failed to fetch attendance data");
        }

        const result: StudentAttendanceResponse = await response.json();
        setData(result);
      } catch (err) {
        console.error("Error fetching student attendance:", err);
        setError("Unable to load attendance data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendance();
  }, [studentInfo?.student_id]);

  // Pagination
  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.ceil(data.records.length / RECORDS_PER_PAGE);
  }, [data]);

  const paginatedRecords = useMemo(() => {
    if (!data) return [];
    const start = (currentPage - 1) * RECORDS_PER_PAGE;
    return data.records.slice(start, start + RECORDS_PER_PAGE);
  }, [data, currentPage]);

  // Determine attendance badge color
  const getAttendanceBadgeColor = (percentage: number) => {
    if (percentage >= 90) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (percentage >= 75) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  if (!studentInfo) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <p className="mt-4 text-gray-400">Session expired. Please log in again.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <p className="mt-4 text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            My Attendance
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            View your attendance history and statistics
          </p>
        </div>
      </div>

      {/* Student Info Card */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              {data?.student_name || studentInfo.student_name}
            </h2>
            <p className="text-sm text-gray-400">
              {studentInfo.student_id}
              {data?.division && ` • ${data.division}`}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Total Classes */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <CalendarDays className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Total Classes</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-white">
            {data?.total_records || 0}
          </p>
        </div>

        {/* Present */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Present</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-400">
            {data?.present_count || 0}
          </p>
        </div>

        {/* Absent */}
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Absent</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-red-400">
            {data?.absent_count || 0}
          </p>
        </div>

        {/* Attendance % */}
        <div
          className={`rounded-xl border p-4 backdrop-blur-sm ${
            data ? getAttendanceBadgeColor(data.attendance_percentage) : "border-white/10 bg-white/[0.03]"
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Attendance</span>
          </div>
          <p className="mt-2 text-2xl font-bold">
            {data?.attendance_percentage ?? 0}%
          </p>
        </div>
      </div>

      {/* Attendance Records Table */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="font-semibold text-white">Attendance History</h3>
          <p className="text-xs text-gray-500">
            {data?.total_records || 0} total records
          </p>
        </div>

        {data?.records && data.records.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs font-medium uppercase text-gray-500">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Time</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedRecords.map((record, idx) => (
                    <tr
                      key={`${record.date}-${idx}`}
                      className="transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-white">{record.date}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-300">{record.time}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {record.status.toLowerCase() === "present" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Present
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-400">
                            <XCircle className="h-3 w-3" />
                            Absent
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
                <p className="text-xs text-gray-500">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-gray-400 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="h-12 w-12 text-gray-600" />
            <p className="mt-4 text-gray-400">No attendance records found</p>
            <p className="mt-1 text-xs text-gray-600">
              Your attendance will appear here once recorded
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
