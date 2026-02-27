"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, UserSearch, ImageOff, ZoomIn, X, AlertCircle, Clock } from "lucide-react";
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
        title="Unknown Faces"
        description="Review unrecognized faces detected during video processing for manual identification."
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
      <div className="alert-warning mb-4 animate-fade-in sm:mb-6">
        <UserSearch className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 hidden sm:block" />
        <div className="text-xs sm:text-sm">
          <p className="font-semibold text-amber-800">
            {totalCount} unknown face{totalCount !== 1 ? "s" : ""} pending
          </p>
          <p className="mt-0.5 text-amber-700">
            Detected in videos but not matched to enrolled students.
          </p>
        </div>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="alert-error mb-6 animate-fade-in">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-700">
            <strong>Error:</strong> {errorMessage}
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <RefreshCw className="mb-3 h-8 w-8 animate-spin text-brand-400" />
          <p className="text-sm font-medium">Loading unknown faces…</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && faces.length === 0 && !errorMessage && (
        <div className="card-elevated flex flex-col items-center justify-center py-24 text-gray-400">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <ImageOff className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-500">No unknown faces found</p>
          <p className="mt-1.5 text-xs text-gray-400 max-w-xs text-center">
            Upload a class video first from the Upload page, then check back here for any unrecognized faces.
          </p>
        </div>
      )}

      {/* ── Responsive Image Grid ──────────────────────── */}
      {!isLoading && faces.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {faces.map((faceEntry, index) => (
            <div
              key={faceEntry.filename}
              className="card-elevated group cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-brand-300 hover:-translate-y-0.5 animate-fade-in"
              style={{ animationDelay: `${index * 0.03}s` }}
              onClick={() => setSelectedImage(faceEntry)}
            >
              {/* Face Image */}
              <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={staticUrl(faceEntry.image_url)}
                  alt={`Unknown face — ${faceEntry.filename}`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/25">
                  <ZoomIn className="h-7 w-7 text-white opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 scale-75" />
                </div>

                {/* Index badge */}
                <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-[10px] font-bold text-white backdrop-blur-sm">
                  {index + 1}
                </div>
              </div>

              {/* Metadata */}
              <div className="px-2 py-2 sm:px-3 sm:py-3">
                <p
                  className="truncate text-[11px] font-semibold text-gray-700 sm:text-xs"
                  title={faceEntry.filename}
                >
                  {faceEntry.filename}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-400 sm:mt-1 sm:text-[11px]">
                  <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative mx-3 max-h-[85vh] max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl animate-scale-in sm:mx-4 sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={staticUrl(selectedImage.image_url)}
              alt={`Unknown face — ${selectedImage.filename}`}
              className="max-h-[70vh] w-full object-contain"
            />
            <div className="border-t border-gray-100 px-4 py-3 sm:px-6 sm:py-4">
              <p className="text-xs font-semibold text-gray-900 sm:text-sm">
                {selectedImage.filename}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                Detected: {formatDetectedAt(selectedImage.detected_at)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
