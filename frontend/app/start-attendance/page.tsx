"use client";

import React from "react";
import { Camera, Play, Square, UserCheck, UserX } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export default function StartAttendancePage(): React.JSX.Element {
  const detectedStudents = [
    { name: "Aarav Deshmukh", id: "CS2025-041", status: "Detected" },
    { name: "Riya Sharma", id: "CS2025-042", status: "Marked Present" },
    { name: "Kabir Singh", id: "CS2025-043", status: "Detected" },
  ];

  return (
    <div>
      <PageHeader
        title="Start Attendance"
        description="Use the live camera feed to detect faces and mark attendance in real time."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        {/* Camera Feed */}
        <div className="card-elevated overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Live Camera Feed</h2>
            <p className="text-xs text-gray-500">OpenCV preview placeholder</p>
          </div>
          <div className="flex min-h-[360px] items-center justify-center bg-gray-50/50">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                <Camera className="h-7 w-7 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Camera feed will appear here</p>
              <p className="mt-1 text-xs text-gray-500">Connect a webcam to start recognition</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-gray-100 px-5 py-4">
            <button className="btn-primary">
              <Play className="h-4 w-4" />
              Start Face Recognition
            </button>
            <button className="btn-secondary">
              <Square className="h-4 w-4" />
              Stop Attendance
            </button>
          </div>
        </div>

        {/* Detected Students */}
        <div className="card-elevated overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Detected Students</h2>
            <p className="text-xs text-gray-500">Live recognition stream</p>
          </div>
          <div className="divide-y divide-gray-100">
            {detectedStudents.map((student) => (
              <div key={student.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{student.name}</p>
                  <p className="text-xs text-gray-500">{student.id}</p>
                </div>
                <span
                  className={
                    student.status === "Marked Present"
                      ? "badge-success"
                      : "badge-info"
                  }
                >
                  {student.status === "Marked Present" ? (
                    <UserCheck className="h-3 w-3" />
                  ) : (
                    <UserX className="h-3 w-3" />
                  )}
                  {student.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
