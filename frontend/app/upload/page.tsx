"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  UploadCloud,
  FileVideo,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import {
  apiUrl,
  type VideoUploadResponse,
  type ErrorResponse,
} from "@/lib/api";

const ALLOWED_VIDEO_TYPES: Set<string> = new Set([
  "video/mp4",
  "video/mpeg",
  "video/x-msvideo",
  "video/quicktime",
  "video/x-matroska",
  "video/webm",
]);

type UploadStatus = "idle" | "dragging" | "uploading" | "success" | "error";

export default function UploadVideoPage(): React.JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [responseMessage, setResponseMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File | null): void => {
    if (!file) return;

    if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
      setUploadStatus("error");
      setResponseMessage(
        `Invalid file type "${file.type}". Please upload an MP4, AVI, MOV, MKV, or WebM file.`
      );
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setUploadStatus("idle");
    setResponseMessage("");
  };

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
    []
  );

  const handleUpload = async (): Promise<void> => {
    if (!selectedFile) return;

    setUploadStatus("uploading");
    setResponseMessage("");

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
      setUploadStatus("success");
      setResponseMessage(data.message);
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
    setSelectedFile(null);
    setUploadStatus("idle");
    setResponseMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
        description="Upload a classroom video for batch attendance processing via face recognition."
      />

      <div className="mx-auto max-w-2xl">
        {/* ── Drag & Drop Zone ─────────────────────────── */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`card flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-16 text-center transition-all duration-200 ${
            uploadStatus === "dragging"
              ? "border-brand-500 bg-brand-50 scale-[1.01]"
              : "border-gray-300 hover:border-brand-400 hover:bg-gray-50"
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
          <div className="mb-4 rounded-full bg-brand-50 p-4">
            <UploadCloud
              className={`h-10 w-10 ${
                uploadStatus === "dragging"
                  ? "text-brand-600"
                  : "text-brand-400"
              }`}
            />
          </div>
          <p className="mb-1 text-sm font-semibold text-gray-700">
            Click to upload or drag &amp; drop
          </p>
          <p className="text-xs text-gray-500">
            MP4, AVI, MOV, MKV, or WebM — Max 50 MB
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/mpeg,video/x-msvideo,video/quicktime,video/x-matroska,video/webm"
            onChange={handleInputChange}
            className="hidden"
            aria-hidden="true"
          />
        </div>

        {/* ── Selected File Preview ────────────────────── */}
        {selectedFile && (
          <div className="card mt-4 flex items-center gap-4 px-5 py-4">
            <div className="rounded-lg bg-brand-50 p-2.5">
              <FileVideo className="h-6 w-6 text-brand-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Remove selected file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Upload Button ────────────────────────────── */}
        {selectedFile && uploadStatus !== "success" && (
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploadStatus === "uploading"}
            className="btn-primary mt-4 w-full"
          >
            {uploadStatus === "uploading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading & Processing…
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                Upload Video for Processing
              </>
            )}
          </button>
        )}

        {/* ── Status Messages ──────────────────────────── */}
        {uploadStatus === "success" && responseMessage && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Processing Started (HTTP 202)
              </p>
              <p className="mt-1 text-sm text-emerald-700">
                {responseMessage}
              </p>
              <p className="mt-2 text-xs text-emerald-600">
                Check the <strong>Unknown Faces</strong> page later to review
                unrecognised individuals.
              </p>
            </div>
          </div>
        )}

        {uploadStatus === "error" && responseMessage && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                Upload Failed
              </p>
              <p className="mt-1 text-sm text-red-700">{responseMessage}</p>
            </div>
          </div>
        )}

        {/* ── Upload Another Button ────────────────────── */}
        {uploadStatus === "success" && (
          <button
            type="button"
            onClick={handleReset}
            className="btn-secondary mt-4 w-full"
          >
            Upload Another Video
          </button>
        )}
      </div>
    </div>
  );
}
