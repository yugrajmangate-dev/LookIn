"use client";

import React, { useState, useRef, useCallback, type ChangeEvent } from "react";
import {
  UserPlus,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { apiUrl, type EnrollmentResponse, type ErrorResponse } from "@/lib/api";

interface ImagePreview {
  id: string;
  file: File;
  previewUrl: string;
}

export default function EnrollStudentPage(): React.JSX.Element {
  /* ── Form state ──────────────────────────────── */
  const [studentId, setStudentId] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [division, setDivision] = useState<string>("");
  const [graduationYear, setGraduationYear] = useState<string>("");
  const [images, setImages] = useState<ImagePreview[]>([]);

  /* ── Submission state ────────────────────────── */
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successResult, setSuccessResult] =
    useState<EnrollmentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Image handling ──────────────────────────── */
  const addImages = useCallback((fileList: FileList | null) => {
    if (!fileList) return;

    const newPreviews: ImagePreview[] = Array.from(fileList)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));

    setImages((previous) => [...previous, ...newPreviews]);
  }, []);

  const removeImage = useCallback((imageId: string) => {
    setImages((previous) => {
      const target = previous.find((img) => img.id === imageId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return previous.filter((img) => img.id !== imageId);
    });
  }, []);

  const clearAllImages = useCallback(() => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [images]);

  /* ── Form submission ─────────────────────────── */
  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setSuccessResult(null);
      setErrorMessage(null);

      if (!studentId.trim() || !studentName.trim() || images.length === 0) {
        setErrorMessage(
          "Please fill in Student ID, Full Name, and add at least one photo."
        );
        return;
      }

      setIsSubmitting(true);

      try {
        const formData = new FormData();
        formData.append("student_id", studentId.trim());
        formData.append("student_name", studentName.trim());
        if (division.trim()) formData.append("division", division.trim());
        if (graduationYear.trim())
          formData.append("graduation_year", graduationYear.trim());
        images.forEach((img) => formData.append("images", img.file));

        const response = await fetch(apiUrl("/api/enroll/"), {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorBody: ErrorResponse = await response.json();
          throw new Error(errorBody.detail ?? errorBody.error);
        }

        const data: EnrollmentResponse = await response.json();
        setSuccessResult(data);

        /* Reset form */
        setStudentId("");
        setStudentName("");
        setDivision("");
        setGraduationYear("");
        clearAllImages();
      } catch (submitError) {
        const message =
          submitError instanceof Error
            ? submitError.message
            : "Enrollment failed. Please try again.";
        setErrorMessage(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [studentId, studentName, division, graduationYear, images, clearAllImages]
  );

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    addImages(event.target.files);
    if (event.target) event.target.value = "";
  };

  /* ── Drag-and-drop ───────────────────────────── */
  const [isDragActive, setIsDragActive] = useState<boolean>(false);

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(false);
    addImages(event.dataTransfer.files);
  };

  /* ── Render ──────────────────────────────────── */
  return (
    <div>
      <PageHeader
        title="Enroll Student"
        description="Register a new student by providing their details and uploading reference photos for face recognition."
      />

      <div className="mx-auto max-w-2xl">
        {/* Success Banner */}
        {successResult && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 animate-fadeIn">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
            <div className="text-sm text-emerald-800">
              <p className="font-semibold">{successResult.message}</p>
              <p className="mt-1 text-emerald-600">
                Student: <strong>{successResult.student_id}</strong> —{" "}
                {successResult.encodings_stored} encoding
                {successResult.encodings_stored !== 1 ? "s" : ""} stored
              </p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 animate-fadeIn">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        {/* ── Enrollment Form ────────────────────────── */}
        <form onSubmit={handleSubmit} className="card space-y-6">
          {/* Student ID */}
          <div>
            <label
              htmlFor="studentId"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Student ID <span className="text-red-400">*</span>
            </label>
            <input
              id="studentId"
              type="text"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              placeholder="e.g. STU-2025-0042"
              required
              className="input-field"
            />
          </div>

          {/* Full Name */}
          <div>
            <label
              htmlFor="studentName"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              id="studentName"
              type="text"
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              placeholder="e.g. Priya Sharma"
              required
              className="input-field"
            />
          </div>

          {/* Division */}
          <div>
            <label
              htmlFor="division"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Division
            </label>
            <input
              id="division"
              type="text"
              value={division}
              onChange={(event) => setDivision(event.target.value)}
              placeholder="e.g. CS-A (optional)"
              className="input-field"
            />
          </div>

          {/* Graduation Year */}
          <div>
            <label
              htmlFor="graduationYear"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Graduation Year
            </label>
            <input
              id="graduationYear"
              type="number"
              value={graduationYear}
              onChange={(event) => setGraduationYear(event.target.value)}
              placeholder="e.g. 2027 (optional)"
              min={2000}
              max={2100}
              className="input-field"
            />
            <p className="mt-1 text-xs text-gray-400">
              Used for alumni cleanup — students past this year can be removed in bulk.
            </p>
          </div>

          {/* ── Photo Upload Zone ──────────────────────── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Reference Photos <span className="text-red-400">*</span>
            </label>

            <div
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                isDragActive
                  ? "border-brand-400 bg-brand-50"
                  : "border-gray-200 bg-gray-50 hover:border-brand-300"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <ImageIcon className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">
                Drag & drop student photos here, or{" "}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-medium text-brand-600 hover:underline"
                >
                  browse files
                </button>
              </p>
              <p className="mt-1 text-xs text-gray-400">
                JPG, PNG — multiple photos improve accuracy
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          </div>

          {/* ── Image Previews ─────────────────────────── */}
          {images.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  {images.length} photo{images.length !== 1 ? "s" : ""} selected
                </p>
                <button
                  type="button"
                  onClick={clearAllImages}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove all
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
                {images.map((img) => (
                  <div key={img.id} className="group relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.previewUrl}
                      alt={img.file.name}
                      className="h-full w-full rounded-lg object-cover ring-1 ring-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-red-500 p-0.5 text-white shadow-sm transition-colors hover:bg-red-600 group-hover:block"
                      aria-label={`Remove ${img.file.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full justify-center"
          >
            {isSubmitting ? (
              <>
                <Upload className="h-4 w-4 animate-spin" />
                Enrolling…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Enroll Student
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
