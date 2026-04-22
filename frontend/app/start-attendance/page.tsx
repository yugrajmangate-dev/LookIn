"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera as CameraIcon,
  Play,
  Square,
  UserCheck,
  UserX,
  AlertCircle,
  UserPlus,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SystemStatusPanel from "@/components/SystemStatusPanel";
import { apiUrl, type WebcamRecognitionResponse, type WebcamFaceMatch } from "@/lib/api";

const ENROLL_PREFILL_IMAGE_KEY = "lookin_enroll_prefill_image";

type DetectionEntry = {
  id: string;
  name: string;
  detail: string;
  status: "Matched" | "Marked Present" | "Unknown";
  detectedAt: string;
  confidence?: number | null;
  faceLocation?: number[];
};

export default function StartAttendancePage(): React.JSX.Element {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const isRunningRef = useRef<boolean>(false);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [hasCameraAccess, setHasCameraAccess] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>(
    "Camera idle. Click start to begin detection."
  );
  const [markingMessage, setMarkingMessage] = useState<string>("");
  const [autoMarkEnabled, setAutoMarkEnabled] = useState<boolean>(true);
  const [detections, setDetections] = useState<DetectionEntry[]>([]);
  const [unknownActionMessage, setUnknownActionMessage] = useState<string>("");
  const [activeUnknownActionId, setActiveUnknownActionId] = useState<string | null>(null);
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
    matches.forEach((match) => {
      const [top, right, bottom, left] = match.face_location;
      const boxWidth = Math.max(0, right - left);
      const boxHeight = Math.max(0, bottom - top);

      const boxColor = match.matched ? "#22c55e" : "#ef4444";
      context.strokeStyle = boxColor;
      context.lineWidth = Math.max(2, Math.round(width / 320));
      context.lineJoin = "round";
      context.strokeRect(left, top, boxWidth, boxHeight);

      const label = match.matched && match.student_name
        ? `Student: ${match.student_name}`
        : "Unknown Face";
      const fontSize = Math.max(12, Math.round((width / 640) * 13));
      context.font = `600 ${fontSize}px Inter, sans-serif`;
      context.textBaseline = "top";
      const textPadding = 6;
      const textWidth = Math.ceil(context.measureText(label).width);
      const labelWidth = textWidth + textPadding * 2;
      const labelHeight = fontSize + 8;
      let labelX = left;
      let labelY = top - labelHeight - 6;
      if (labelY < 0) labelY = top + 6;
      if (labelX + labelWidth > width) {
        labelX = Math.max(0, width - labelWidth - 2);
      }

      context.fillStyle = match.matched ? "rgba(22, 101, 52, 0.92)" : "rgba(127, 29, 29, 0.92)";
      context.fillRect(labelX, labelY, labelWidth, labelHeight);

      context.fillStyle = "#ffffff";
      context.fillText(label, labelX + textPadding, labelY + 4);
    });
  }, []);

  const faceCropToDataUrl = useCallback(async (faceLocation: number[]): Promise<string | null> => {
    const video = videoRef.current;
    if (!video) return null;

    const frameWidth = video.videoWidth || 640;
    const frameHeight = video.videoHeight || 480;

    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement("canvas");
    }

    const fullCanvas = captureCanvasRef.current;
    fullCanvas.width = frameWidth;
    fullCanvas.height = frameHeight;

    const fullContext = fullCanvas.getContext("2d");
    if (!fullContext) return null;
    fullContext.drawImage(video, 0, 0, frameWidth, frameHeight);

    const [top, right, bottom, left] = faceLocation;
    const rawWidth = Math.max(1, right - left);
    const rawHeight = Math.max(1, bottom - top);

    const marginX = Math.round(rawWidth * 0.25);
    const marginY = Math.round(rawHeight * 0.25);

    const cropLeft = Math.max(0, left - marginX);
    const cropTop = Math.max(0, top - marginY);
    const cropRight = Math.min(frameWidth, right + marginX);
    const cropBottom = Math.min(frameHeight, bottom + marginY);
    const cropWidth = Math.max(1, cropRight - cropLeft);
    const cropHeight = Math.max(1, cropBottom - cropTop);

    const faceCanvas = document.createElement("canvas");
    faceCanvas.width = cropWidth;
    faceCanvas.height = cropHeight;
    const faceContext = faceCanvas.getContext("2d");
    if (!faceContext) return null;

    faceContext.drawImage(
      fullCanvas,
      cropLeft,
      cropTop,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      faceCanvas.toBlob((resultBlob) => resolve(resultBlob), "image/jpeg", 0.9);
    });

    if (!blob) return null;

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Unable to read captured face image."));
        }
      };
      reader.onerror = () => reject(new Error("Unable to prepare captured face image."));
      reader.readAsDataURL(blob);
    });
  }, []);

  const enrollUnknownFace = useCallback(async (entry: DetectionEntry) => {
    if (!entry.faceLocation || entry.status !== "Unknown") return;

    try {
      setActiveUnknownActionId(entry.id);
      setUnknownActionMessage("");

      const imageDataUrl = await faceCropToDataUrl(entry.faceLocation);
      if (!imageDataUrl) {
        throw new Error("Face crop is unavailable. Keep the camera running and try again.");
      }

      sessionStorage.setItem(
        ENROLL_PREFILL_IMAGE_KEY,
        JSON.stringify({
          imageDataUrl,
          source: "start-attendance",
          capturedAt: new Date().toISOString(),
        })
      );

      router.push("/enroll?prefill=unknown");
    } catch (error) {
      setUnknownActionMessage(
        error instanceof Error
          ? error.message
          : "Unable to prepare this face for enrollment."
      );
    } finally {
      setActiveUnknownActionId(null);
    }
  }, [faceCropToDataUrl, router]);

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
        0.92
      );
    });
  }, []);

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
      let failedCount = 0;
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
        } else {
          failedCount += 1;
        }
      }

      if (markedCount > 0) {
        setMarkingMessage(`Marked ${markedCount} student${markedCount === 1 ? "" : "s"} present.`);
      } else if (failedCount > 0) {
        setMarkingMessage("Detected matches, but attendance write failed. Check backend/API connection.");
      }
    } catch (error) {
      setMarkingMessage(
        error instanceof Error
          ? `Attendance marking failed: ${error.message}`
          : "Attendance marking failed."
      );
    }
  }, []);

  const sendFrameForRecognition = useCallback(async () => {
    if (inFlightRef.current || !isRunningRef.current) return;
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

      if (payload.faces_found > 0 && payload.students_matched === 0) {
        setMarkingMessage(
          "Face detected but not matched. Improve lighting/front angle or enroll 2-3 more photos."
        );
      }

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
        faceLocation: match.face_location,
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
  }, [autoMarkEnabled, captureFrame, drawMatches, markStudentsPresent]);

  const startDetection = useCallback(async () => {
    if (!videoRef.current) return;

    setHasCameraAccess(true);
    setStatusMessage("Starting camera...");
    setDetections([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      markedStudentIdsRef.current.clear();
      isRunningRef.current = true;
      setIsRunning(true);
      setStatusMessage("Camera live. Sending frames to the backend for recognition.");
      setMarkingMessage("");

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        void sendFrameForRecognition();
      }, 1500);
      void sendFrameForRecognition();
    } catch (error) {
      isRunningRef.current = false;
      setIsRunning(false);
      setHasCameraAccess(false);
      const cameraErrorMessage = error instanceof Error ? error.message : "";
      if (cameraErrorMessage.toLowerCase().includes("denied") || cameraErrorMessage.toLowerCase().includes("notallowed")) {
        setStatusMessage("Camera access is blocked. Allow camera permission in browser site settings, then click Start Recognition again.");
      } else {
        setStatusMessage(
          error instanceof Error
            ? error.message
            : "Unable to access camera. Check permissions."
        );
      }
    }
  }, [sendFrameForRecognition]);

  const stopDetection = useCallback(() => {
    isRunningRef.current = false;
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
    setUnknownActionMessage("");
    setActiveUnknownActionId(null);
  }, []);

  useEffect(() => {
    return () => {
      isRunningRef.current = false;
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
            {unknownActionMessage && (
              <div className="mt-2 text-xs text-amber-700">
                {unknownActionMessage}
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
                <div key={entry.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{entry.name}</p>
                    <p className="text-xs text-gray-500">{entry.detail} · {entry.detectedAt}</p>
                    {entry.status === "Unknown" && entry.faceLocation && (
                      <button
                        type="button"
                        onClick={() => void enrollUnknownFace(entry)}
                        disabled={activeUnknownActionId === entry.id || !isRunning}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        {activeUnknownActionId === entry.id ? "Preparing…" : "Enroll This Face"}
                      </button>
                    )}
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
