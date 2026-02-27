"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  UploadCloud,
  FileVideo,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Video,
  Users,
  UserX,
  Layers,
  Eye,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import {
  apiUrl,
  type VideoUploadResponse,
  type JobStatusResponse,
  type ErrorResponse,
} from "@/lib/api";

const ALLOWED_VIDEO_EXTENSIONS = new Set([
  ".mp4", ".mpeg", ".mpg", ".avi", ".mov",
  ".mkv", ".webm", ".m4v", ".3gp", ".wmv",
]);

type UploadStatus = "idle" | "dragging" | "uploading" | "processing" | "success" | "error";

export default function UploadVideoPage(): React.JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [responseMessage, setResponseMessage] = useState<string>("");
  const [, setJobId] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<JobStatusResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /* ── File validation using extension (more reliable than MIME) ── */
  const isValidVideoFile = useCallback((file: File): boolean => {
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    return ALLOWED_VIDEO_EXTENSIONS.has(extension);
  }, []);

  const handleFileSelect = useCallback((file: File | null): void => {
    if (!file) return;

    if (!isValidVideoFile(file)) {
      setUploadStatus("error");
      setResponseMessage(
        `"${file.name}" is not a supported video format. Please upload an MP4, AVI, MOV, MKV, or WebM file.`
      );
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setUploadStatus("idle");
    setResponseMessage("");
    setJobResult(null);
    setJobId(null);
  }, [isValidVideoFile]);

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const file = event.target.files?.[0] ?? null;
    handleFileSelect(file);
  };

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      setUploadStatus("dragging");
    },
    []
  );

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      setUploadStatus((previous) =>
        previous === "dragging" ? "idle" : previous
      );
    },
    []
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      setUploadStatus("idle");
      const file = event.dataTransfer.files?.[0] ?? null;
      handleFileSelect(file);
    },
    [handleFileSelect]
  );

  /* ── Job status polling ─────────────────────────── */
  const startPolling = useCallback((id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(apiUrl(`/api/attendance/job-status/${id}`));
        if (!response.ok) return;
        const data: JobStatusResponse = await response.json();
        setJobResult(data);

        if (data.status === "completed" || data.status === "failed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setUploadStatus(data.status === "completed" ? "success" : "error");
          if (data.status === "failed") {
            setResponseMessage(data.error || "Processing failed unexpectedly.");
          }
        }
      } catch {
        // Silently retry on network errors
      }
    }, 2000);
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  /* ── Upload handler ─────────────────────────────── */
  const handleUpload = async (): Promise<void> => {
    if (!selectedFile) return;

    setUploadStatus("uploading");
    setResponseMessage("");
    setJobResult(null);

    const formData = new FormData();
    formData.append("video", selectedFile);

    try {
      const response = await fetch(apiUrl("/api/attendance/upload-video"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorBody: ErrorResponse = await response.json();
        throw new Error(errorBody.detail ?? errorBody.error);
      }

      const data: VideoUploadResponse = await response.json();
      setJobId(data.job_id);
      setUploadStatus("processing");
      setResponseMessage(data.message);
      startPolling(data.job_id);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "An unexpected error occurred during upload.";
      setUploadStatus("error");
      setResponseMessage(message);
    }
  };

  const handleReset = (): void => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setSelectedFile(null);
    setUploadStatus("idle");
    setResponseMessage("");
    setJobId(null);
    setJobResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <PageHeader
        title="Upload Video"
        description="Upload a classroom video for AI-powered batch attendance processing via face recognition."
      />

      <div className="mx-auto max-w-3xl">
        {/* ── Info Banner ───────────────────────────────── */}
        <div className="alert-info mb-4 sm:mb-6 animate-fade-in">
          <Video className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 hidden sm:block" />
          <div className="text-xs sm:text-sm text-blue-800">
            <p className="font-semibold">How it works</p>
            <p className="mt-1 text-blue-700">
              Upload a classroom video and our AI engine will automatically detect student faces,
              match them against enrolled records, and mark attendance.
            </p>
          </div>
        </div>

        {/* ── Drag & Drop Zone ─────────────────────────── */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`card-elevated flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-4 py-12 sm:px-8 sm:py-20 text-center transition-all duration-300 ${
            uploadStatus === "dragging"
              ? "border-brand-500 bg-brand-50/80 scale-[1.01] shadow-lg shadow-brand-500/10"
              : "border-gray-200 hover:border-brand-400 hover:bg-gray-50/50 hover:shadow-md"
          }`}
          role="button"
          tabIndex={0}
          aria-label="Click or drag and drop a video file to upload"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              fileInputRef.current?.click();
            }
          }}
        >
          <div
            className={`mb-4 rounded-2xl p-4 sm:mb-5 sm:p-5 transition-colors duration-300 ${
              uploadStatus === "dragging"
                ? "bg-brand-100"
                : "bg-gradient-to-br from-brand-50 to-blue-50"
            }`}
          >
            <UploadCloud
              className={`h-10 w-10 sm:h-12 sm:w-12 transition-colors duration-300 ${
                uploadStatus === "dragging"
                  ? "text-brand-600"
                  : "text-brand-400"
              }`}
            />
          </div>
          <p className="mb-1 text-sm font-semibold text-gray-800 sm:mb-1.5 sm:text-base">
            Tap to upload or drag &amp; drop
          </p>
          <p className="text-xs text-gray-500 sm:text-sm">
            MP4, AVI, MOV, MKV, or WebM — Max 100 MB
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleInputChange}
            className="hidden"
            aria-hidden="true"
          />
        </div>

        {/* ── Selected File Preview ────────────────────── */}
        {selectedFile && (
          <div className="card mt-4 flex items-center gap-4 px-5 py-4 animate-fade-in">
            <div className="rounded-xl bg-gradient-to-br from-brand-50 to-blue-50 p-3">
              <FileVideo className="h-6 w-6 text-brand-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            {uploadStatus !== "processing" && uploadStatus !== "uploading" && (
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Remove selected file"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* ── Upload Button ────────────────────────────── */}
        {selectedFile && uploadStatus !== "success" && uploadStatus !== "processing" && (
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploadStatus === "uploading"}
            className="btn-primary mt-5 w-full py-3 text-base"
          >
            {uploadStatus === "uploading" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Uploading Video…
              </>
            ) : (
              <>
                <UploadCloud className="h-5 w-5" />
                Upload &amp; Start Processing
              </>
            )}
          </button>
        )}

        {/* ── Processing Status ────────────────────────── */}
        {uploadStatus === "processing" && (
          <div className="mt-6 animate-fade-in">
            <div className="card-elevated overflow-hidden">
              {/* Progress Header */}
              <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-4 sm:px-6 sm:py-5">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full border-[3px] border-white/20"></div>
                    <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-white" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">
                      Processing Video…
                    </p>
                    <p className="text-sm text-white/70">
                      AI engine is analyzing frames for face detection
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div className="h-full animate-pulse rounded-full bg-white/80" style={{ width: "60%" }}></div>
                </div>
              </div>

              {/* Live Stats */}
              {jobResult && (
                <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-4">
                  <div className="bg-white px-3 py-3 text-center sm:px-4 sm:py-4">
                    <Layers className="mx-auto h-4 w-4 sm:h-5 sm:w-5 text-gray-400 mb-1" />
                    <p className="text-base font-bold text-gray-900 sm:text-lg">{jobResult.frames_processed}</p>
                    <p className="text-[10px] sm:text-[11px] text-gray-500">Frames</p>
                  </div>
                  <div className="bg-white px-3 py-3 text-center sm:px-4 sm:py-4">
                    <Eye className="mx-auto h-4 w-4 sm:h-5 sm:w-5 text-blue-400 mb-1" />
                    <p className="text-base font-bold text-gray-900 sm:text-lg">{jobResult.faces_detected}</p>
                    <p className="text-[10px] sm:text-[11px] text-gray-500">Faces</p>
                  </div>
                  <div className="bg-white px-3 py-3 text-center sm:px-4 sm:py-4">
                    <Users className="mx-auto h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 mb-1" />
                    <p className="text-base font-bold text-emerald-600 sm:text-lg">{jobResult.students_matched}</p>
                    <p className="text-[10px] sm:text-[11px] text-gray-500">Matched</p>
                  </div>
                  <div className="bg-white px-3 py-3 text-center sm:px-4 sm:py-4">
                    <UserX className="mx-auto h-4 w-4 sm:h-5 sm:w-5 text-amber-500 mb-1" />
                    <p className="text-base font-bold text-amber-600 sm:text-lg">{jobResult.unknown_faces_saved}</p>
                    <p className="text-[10px] sm:text-[11px] text-gray-500">Unknown</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Success Result ───────────────────────────── */}
        {uploadStatus === "success" && jobResult && (
          <div className="mt-6 space-y-4 animate-slide-up">
            <div className="alert-success">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  Video Processing Complete
                </p>
                <p className="mt-1 text-sm text-emerald-700">
                  All frames have been analyzed and attendance records updated.
                </p>
              </div>
            </div>

            {/* Results Dashboard */}
            <div className="card-elevated overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-3 sm:px-6 sm:py-4">
                <h3 className="text-sm font-semibold text-gray-800">Processing Results</h3>
              </div>
              <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-4">
                <div className="bg-white px-3 py-4 text-center sm:px-5 sm:py-5">
                  <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 sm:mb-2 sm:h-10 sm:w-10 sm:rounded-xl">
                    <Layers className="h-4 w-4 text-gray-500 sm:h-5 sm:w-5" />
                  </div>
                  <p className="text-xl font-bold text-gray-900 sm:text-2xl">{jobResult.frames_processed}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500 sm:text-xs">Frames</p>
                </div>
                <div className="bg-white px-3 py-4 text-center sm:px-5 sm:py-5">
                  <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 sm:mb-2 sm:h-10 sm:w-10 sm:rounded-xl">
                    <Eye className="h-4 w-4 text-blue-500 sm:h-5 sm:w-5" />
                  </div>
                  <p className="text-xl font-bold text-gray-900 sm:text-2xl">{jobResult.faces_detected}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500 sm:text-xs">Faces</p>
                </div>
                <div className="bg-white px-3 py-4 text-center sm:px-5 sm:py-5">
                  <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 sm:mb-2 sm:h-10 sm:w-10 sm:rounded-xl">
                    <Users className="h-4 w-4 text-emerald-600 sm:h-5 sm:w-5" />
                  </div>
                  <p className="text-xl font-bold text-emerald-600 sm:text-2xl">{jobResult.students_matched}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500 sm:text-xs">Matched</p>
                </div>
                <div className="bg-white px-3 py-4 text-center sm:px-5 sm:py-5">
                  <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 sm:mb-2 sm:h-10 sm:w-10 sm:rounded-xl">
                    <UserX className="h-4 w-4 text-amber-600 sm:h-5 sm:w-5" />
                  </div>
                  <p className="text-xl font-bold text-amber-600 sm:text-2xl">{jobResult.unknown_faces_saved}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500 sm:text-xs">Unknown</p>
                </div>
              </div>

              {/* Errors list */}
              {jobResult.errors.length > 0 && (
                <div className="border-t border-gray-100 px-6 py-4">
                  <p className="mb-2 text-xs font-semibold text-red-600">Processing Warnings</p>
                  <ul className="space-y-1">
                    {jobResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i} className="text-xs text-red-500">{err}</li>
                    ))}
                    {jobResult.errors.length > 5 && (
                      <li className="text-xs text-red-400">
                        +{jobResult.errors.length - 5} more warnings
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row">
              {jobResult.unknown_faces_saved > 0 && (
                <Link href="/review" className="btn-primary flex-1 justify-center py-3">
                  <UserX className="h-4 w-4" />
                  Review Unknown Faces ({jobResult.unknown_faces_saved})
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link href="/" className="btn-secondary flex-1 justify-center py-3">
                <Users className="h-4 w-4" />
                View Attendance Roster
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="btn-ghost w-full justify-center"
            >
              Upload Another Video
            </button>
          </div>
        )}

        {/* ── Error State ──────────────────────────────── */}
        {uploadStatus === "error" && responseMessage && (
          <div className="mt-6 animate-fade-in">
            <div className="alert-error">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  {jobResult ? "Processing Failed" : "Upload Failed"}
                </p>
                <p className="mt-1 text-sm text-red-700">{responseMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary mt-4 w-full justify-center"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
