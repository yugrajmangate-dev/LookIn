"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Link as LinkIcon, Camera } from "lucide-react";
import { apiUrl } from "@/lib/api";

type CameraState = "granted" | "denied" | "idle" | "unknown";

interface SystemStatusPanelProps {
  cameraState?: CameraState;
}

export default function SystemStatusPanel({
  cameraState = "unknown",
}: SystemStatusPanelProps): React.JSX.Element {
  const [backendConnected, setBackendConnected] = useState<boolean>(false);

  const backendUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
  }, []);

  useEffect(() => {
    let active = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const checkBackend = async () => {
      try {
        const response = await fetch(apiUrl("/"), { method: "GET" });
        if (!active) return;
        setBackendConnected(response.ok);
      } catch {
        if (!active) return;
        setBackendConnected(false);
      }
    };

    void checkBackend();

    const scheduleChecks = () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      // Poll less frequently and only while tab is visible to reduce load.
      if (document.visibilityState === "visible") {
        intervalId = setInterval(() => {
          void checkBackend();
        }, 30000);
      }
    };

    scheduleChecks();
    document.addEventListener("visibilitychange", scheduleChecks);

    return () => {
      active = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      document.removeEventListener("visibilitychange", scheduleChecks);
    };
  }, []);

  const cameraLabel =
    cameraState === "granted"
      ? "Granted"
      : cameraState === "denied"
        ? "Denied"
        : cameraState === "idle"
          ? "Idle"
          : "Unknown";

  return (
    <div className="card mb-4 border border-gray-200/80 px-4 py-3 text-xs sm:text-sm">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        <div className="flex items-center gap-2">
          {backendConnected ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="text-gray-700">
            Backend: <strong>{backendConnected ? "Connected" : "Disconnected"}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-blue-500" />
          <span className="text-gray-700 truncate" title={backendUrl}>
            API: <strong>{backendUrl}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-amber-500" />
          <span className="text-gray-700">
            Camera: <strong>{cameraLabel}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
