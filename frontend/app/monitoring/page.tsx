"use client";

import React from "react";
import { Camera, Signal, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export default function CameraMonitoringPage(): React.JSX.Element {
  return (
    <div>
      <PageHeader
        title="Camera Monitoring"
        description="Monitor classroom cameras and review live feed status."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {["Classroom A", "Classroom B", "Lab 2"].map((room) => (
          <div key={room} className="card-elevated overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">{room}</h2>
              <p className="text-xs text-gray-500">Live feed placeholder</p>
            </div>
            <div className="flex min-h-[180px] items-center justify-center bg-gray-50/60">
              <Camera className="h-8 w-8 text-gray-400" />
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Signal className="h-3.5 w-3.5" />
                Signal: Stable
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                Alerts: 0
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
