"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, Play, Square, UserCheck, UserX, AlertCircle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SystemStatusPanel from "@/components/SystemStatusPanel";
import { apiUrl, type WebcamRecognitionResponse, type WebcamFaceMatch } from "@/lib/api";

type DetectionEntry = {
  id: string;
  name: string;
  detail: string;
  status: "Matched" | "Marked Present" | "Unknown";
  detectedAt: string;
  confidence?: number | null;
};

export default function StartAttendancePage(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [hasCameraAccess, setHasCameraAccess] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>(
    "Camera idle. Click start to begin detection."
  );
  const [markingMessage, setMarkingMessage] = useState<string>("");
  const [autoMarkEnabled, setAutoMarkEnabled] = useState<boolean>(true);
  const [detections, setDetections] = useState<DetectionEntry[]>([]);
  const markedStudentIdsRef = useRef<Set<string>>(new Set());

  const drawMatches = useCallback((matches: WebcamFaceMatch[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;

    context.clearRect(0, 0, width, height);
    context.lineWidth = 2;

    matches.forEach((match) => {
      const [top, right, bottom, left] = match.face_location;
      const boxWidth = Math.max(0, right - left);
      const boxHeight = Math.max(0, bottom - top);

      context.strokeStyle = match.matched ? "#22c55e" : "#f59e0b";
      context.strokeRect(left, top, boxWidth, boxHeight);
    });
  }, []);

  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video) return null;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement("canvas");
    }

    const captureCanvas = captureCanvasRef.current;
    captureCanvas.width = width;
    captureCanvas.height = height;

    const context = captureCanvas.getContext("2d");
    if (!context) return null;

    context.drawImage(video, 0, 0, width, height);

    return new Promise((resolve) => {
      captureCanvas.toBlob(
        (blob) => resolve(blob),
        "image/jpeg",
        0.8
      );
    });
  }, []);

  const sendFrameForRecognition = useCallback(async () => {
    if (inFlightRef.current || !isRunning) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    inFlightRef.current = true;

    try {
      const blob = await captureFrame();
      if (!blob) return;

      const formData = new FormData();
      formData.append("frame", blob, "frame.jpg");

      const response = await fetch(apiUrl("/api/attendance/webcam-frame"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        setStatusMessage("Recognition error. Check backend connection.");
        return;
      }

      const payload: WebcamRecognitionResponse = await response.json();

      if (payload.faces_found === 0) {
        setStatusMessage("No faces detected yet. Keep the camera steady.");
        drawMatches([]);
        setDetections([]);
        return;
      }

      setStatusMessage(
        `Detected ${payload.faces_found} face${payload.faces_found === 1 ? "" : "s"}. ` +
        `${payload.students_matched} matched.`
      );

      drawMatches(payload.matches);

      const nowLabel = new Date().toLocaleTimeString();
      const entries: DetectionEntry[] = payload.matches.map((match, index) => ({
        id: `${Date.now()}-${index}`,
        name: match.student_name ?? "Unknown Face",
        detail: match.student_id
          ? `${match.student_id}${match.division ? ` · ${match.division}` : ""}`
          : "Not enrolled",
        status: match.matched
          ? markedStudentIdsRef.current.has(match.student_id ?? "")
            ? "Marked Present"
            : "Matched"
          : "Unknown",
        detectedAt: nowLabel,
        confidence: match.confidence ?? null,
      }));

      setDetections(entries.slice(0, 6));

      if (autoMarkEnabled) {
        void markStudentsPresent(payload.matches);
      }
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Recognition failed. Check network or backend."
      );
    } finally {
      inFlightRef.current = false;
    }
  }, [autoMarkEnabled, captureFrame, drawMatches, isRunning]);

  const markStudentsPresent = useCallback(async (matches: WebcamFaceMatch[]) => {
    const today = new Date().toISOString().slice(0, 10);
    const pending = matches.filter(
      (match) =>
        match.matched &&
        match.student_id &&
        !markedStudentIdsRef.current.has(match.student_id)
    );

    if (pending.length === 0) return;

    try {
      let markedCount = 0;
      for (const match of pending) {
        const response = await fetch(apiUrl("/api/attendance/manual-override"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id: match.student_id,
            student_name: match.student_name ?? "Unknown",
            division: match.division ?? null,
            date: today,
            status: "present",
          }),
        });

        if (response.ok && match.student_id) {
          markedStudentIdsRef.current.add(match.student_id);
          markedCount += 1;
        }
      }

      if (markedCount > 0) {
        setMarkingMessage(`Marked ${markedCount} student${markedCount === 1 ? "" : "s"} present.`);
      }
    } catch (error) {
      setMarkingMessage(
        error instanceof Error
          ? `Attendance marking failed: ${error.message}`
          : "Attendance marking failed."
      );
    }
  }, []);

  const startDetection = useCallback(async () => {
    if (!videoRef.current) return;

    setHasCameraAccess(true);
    setStatusMessage("Starting camera...");
    setDetections([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      markedStudentIdsRef.current.clear();
      setIsRunning(true);
      setStatusMessage("Camera live. Sending frames to the backend for recognition.");
      setMarkingMessage("");

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        void sendFrameForRecognition();
      }, 1500);
    } catch (error) {
      setIsRunning(false);
      setHasCameraAccess(false);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to access camera. Check permissions."
      );
    }
  }, [sendFrameForRecognition]);

  const stopDetection = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }

    setIsRunning(false);
    setStatusMessage("Camera stopped. You can start again anytime.");
    setMarkingMessage("");
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Start Attendance"
        description="Use the live camera feed to detect faces and mark attendance in real time."
      />

      <SystemStatusPanel cameraState={isRunning ? "granted" : hasCameraAccess ? "idle" : "denied"} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        {/* Camera Feed */}
        <div className="card-elevated overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Live Camera Feed</h2>
            <p className="text-xs text-gray-500">Backend-powered face recognition</p>
          </div>
          <div className="relative min-h-[360px] bg-gray-50/50">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              autoPlay
              playsInline
              muted
              aria-label="Camera feed preview for face recognition"
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute left-0 top-0 h-full w-full"
            />
            {!isRunning && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <CameraIcon className="h-7 w-7 text-gray-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Camera feed will appear here</p>
                  <p className="mt-1 text-xs text-gray-500">Click start to enable webcam recognition</p>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn-primary" onClick={startDetection} disabled={isRunning}>
                <Play className="h-4 w-4" />
                Start Recognition
              </button>
              <button className="btn-secondary" onClick={stopDetection} disabled={!isRunning}>
                <Square className="h-4 w-4" />
                Stop Camera
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
              <input
                id="auto-mark"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
                checked={autoMarkEnabled}
                onChange={(event) => setAutoMarkEnabled(event.target.checked)}
              />
              <label htmlFor="auto-mark">Auto-mark matched students present</label>
            </div>
            <div className="mt-3 flex items-start gap-2 text-xs text-gray-600">
              {!hasCameraAccess && <AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />}
              <p>{statusMessage}</p>
            </div>
            {markingMessage && (
              <div className="mt-2 text-xs text-emerald-600">
                {markingMessage}
              </div>
            )}
          </div>
        </div>

        {/* Detected Students */}
        <div className="card-elevated overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Detected Students</h2>
            <p className="text-xs text-gray-500">Live recognition stream</p>
          </div>
          <div className="divide-y divide-gray-100" aria-live="polite" aria-label="Detected students list">
            {detections.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-gray-500">
                No detections yet. Start the camera to see live updates.
              </div>
            ) : (
              detections.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{entry.name}</p>
                    <p className="text-xs text-gray-500">{entry.detail} · {entry.detectedAt}</p>
                  </div>
                  <span
                    className={
                      entry.status === "Matched" || entry.status === "Marked Present"
                        ? "badge-success"
                        : "badge-info"
                    }
                  >
                    {entry.status === "Matched" || entry.status === "Marked Present" ? (
                      <UserCheck className="h-3 w-3" />
                    ) : (
                      <UserX className="h-3 w-3" />
                    )}
                    {entry.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
