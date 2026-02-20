"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, UserSearch, ImageOff, ZoomIn } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import {
  apiUrl,
  staticUrl,
  type UnknownFaceEntry,
  type UnknownFacesListResponse,
  type ErrorResponse,
} from "@/lib/api";

export default function UnknownFacesReviewPage(): React.JSX.Element {
  const [faces, setFaces] = useState<UnknownFaceEntry[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<UnknownFaceEntry | null>(
    null
  );

  const fetchUnknownFaces = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(apiUrl("/api/attendance/unknown-faces"));

      if (!response.ok) {
        const errorBody: ErrorResponse = await response.json();
        throw new Error(errorBody.detail ?? errorBody.error);
      }

      const data: UnknownFacesListResponse = await response.json();
      setFaces(data.faces);
      setTotalCount(data.total_count);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to fetch unknown faces.";
      setErrorMessage(message);
      setFaces([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnknownFaces();
  }, [fetchUnknownFaces]);

  const formatDetectedAt = (isoString: string | null): string => {
    if (!isoString) return "Unknown time";
    try {
      const dateObject = new Date(isoString);
      return dateObject.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div>
      <PageHeader
        title="Unknown Faces Review"
        description="Review unrecognised faces detected during video processing for manual identification."
      >
        <button
          type="button"
          onClick={fetchUnknownFaces}
          disabled={isLoading}
          className="btn-secondary"
          aria-label="Refresh unknown faces"
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </PageHeader>

      {/* Summary */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
        <UserSearch className="h-5 w-5 text-amber-600" />
        <span className="text-sm font-medium text-amber-800">
          {totalCount} unknown face{totalCount !== 1 ? "s" : ""} pending review
        </span>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <RefreshCw className="mb-3 h-8 w-8 animate-spin" />
          <p className="text-sm">Loading unknown faces…</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && faces.length === 0 && !errorMessage && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <ImageOff className="mb-3 h-12 w-12" />
          <p className="text-sm font-medium">No unknown faces found</p>
          <p className="mt-1 text-xs">
            Upload a class video first, then check back here.
          </p>
        </div>
      )}

      {/* ── Responsive Image Grid ──────────────────────── */}
      {!isLoading && faces.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {faces.map((faceEntry) => (
            <div
              key={faceEntry.filename}
              className="card group cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-md hover:ring-2 hover:ring-brand-300"
              onClick={() => setSelectedImage(faceEntry)}
            >
              {/* Face Image */}
              <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={staticUrl(faceEntry.image_url)}
                  alt={`Unknown face — ${faceEntry.filename}`}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                  <ZoomIn className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </div>

              {/* Metadata */}
              <div className="px-3 py-2.5">
                <p
                  className="truncate text-xs font-medium text-gray-700"
                  title={faceEntry.filename}
                >
                  {faceEntry.filename}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {formatDetectedAt(faceEntry.detected_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Lightbox Modal ─────────────────────────────── */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative mx-4 max-h-[85vh] max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={staticUrl(selectedImage.image_url)}
              alt={`Unknown face — ${selectedImage.filename}`}
              className="max-h-[70vh] w-full object-contain"
            />
            <div className="border-t border-gray-100 px-5 py-3">
              <p className="text-sm font-medium text-gray-900">
                {selectedImage.filename}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Detected: {formatDetectedAt(selectedImage.detected_at)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute right-3 top-3 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
              aria-label="Close preview"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
