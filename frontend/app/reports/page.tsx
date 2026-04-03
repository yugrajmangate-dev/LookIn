"use client";

import React from "react";
import { CalendarDays, Download, BarChart3 } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export default function AttendanceReportsPage(): React.JSX.Element {
  return (
    <div>
      <PageHeader
        title="Attendance Reports"
        description="Filter by date and subject, export attendance, and review analytics."
      >
        <button className="btn-secondary">
          <Download className="h-4 w-4" />
          Download Report
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Filters */}
        <div className="card-elevated p-5">
          <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="filter-date" className="mb-1.5 block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Date
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                <CalendarDays className="h-4 w-4 text-gray-400" />
                <input id="filter-date" type="date" className="w-full text-sm text-gray-700 focus:outline-none" />
              </div>
            </div>
            <div>
              <label htmlFor="filter-subject" className="mb-1.5 block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Subject
              </label>
              <select id="filter-subject" className="input-field">
                <option>Data Structures</option>
                <option>Operating Systems</option>
                <option>DBMS</option>
              </select>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="card-elevated p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Attendance Stats</h2>
            <BarChart3 className="h-4 w-4 text-gray-400" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-4 text-center">
              <p className="text-xs text-gray-500">Chart Placeholder</p>
              <p className="mt-2 text-sm font-semibold text-gray-700">Present vs Absent</p>
            </div>
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-4 text-center">
              <p className="text-xs text-gray-500">Chart Placeholder</p>
              <p className="mt-2 text-sm font-semibold text-gray-700">Trends Over Time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="card-elevated mt-6 overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Attendance Table</h2>
          <p className="text-xs text-gray-500">Filtered student records appear here</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-white">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Roll No.</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[1, 2, 3].map((row) => (
                <tr key={row} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3 text-gray-600">—</td>
                  <td className="px-5 py-3 text-gray-600">—</td>
                  <td className="px-5 py-3 text-gray-600">—</td>
                  <td className="px-5 py-3 text-gray-600">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
