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
  Camera,
  Hash,
  User,
  GraduationCap,
  Layers,
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

      <div className="mx-auto max-w-3xl">
        {/* ── Guidelines Info ──────────────────────────── */}
        <div className="alert-info mb-4 animate-fade-in sm:mb-6">
          <Camera className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 hidden sm:block" />
          <div className="text-xs text-blue-800 sm:text-sm">
            <p className="font-semibold">Photo Guidelines</p>
            <ul className="mt-1 space-y-0.5 text-blue-700 list-disc ml-4 sm:mt-1.5">
              <li>Upload 3-5 clear, front-facing photos</li>
              <li>Different angles and lighting help</li>
              <li>One face visible per photo</li>
              <li>Avoid blurry or dark images</li>
            </ul>
          </div>
        </div>

        {/* Success Banner */}
        {successResult && (
          <div className="alert-success mb-6 animate-slide-up">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
            <div className="text-sm text-emerald-800">
              <p className="font-semibold">{successResult.message}</p>
              <p className="mt-1 text-emerald-700">
                Student: <strong>{successResult.student_id}</strong> &mdash;{" "}
                {successResult.encodings_stored} face encoding
                {successResult.encodings_stored !== 1 ? "s" : ""} stored successfully
              </p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="alert-error mb-6 animate-fade-in">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        {/* ── Enrollment Form ────────────────────────── */}
        <form onSubmit={handleSubmit} className="card-elevated overflow-hidden">
          {/* Form Header */}
          <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-3 sm:px-6 sm:py-4">
            <h2 className="text-sm font-semibold text-gray-800 sm:text-base">Student Information</h2>
            <p className="mt-0.5 text-[11px] text-gray-500 sm:text-xs">Fields marked with * are required</p>
          </div>

          <div className="p-4 space-y-4 sm:p-6 sm:space-y-5">
            {/* Row 1: Student ID & Full Name */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5">
              <div>
                <label
                  htmlFor="studentId"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 uppercase tracking-wider sm:mb-1.5 sm:text-xs"
                >
                  <Hash className="h-3 w-3" />
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

              <div>
                <label
                  htmlFor="studentName"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  <User className="h-3 w-3" />
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
            </div>

            {/* Row 2: Division & Graduation Year */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="division"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  <Layers className="h-3 w-3" />
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

              <div>
                <label
                  htmlFor="graduationYear"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  <GraduationCap className="h-3 w-3" />
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
                <p className="mt-1.5 text-[11px] text-gray-400">
                  Used for alumni cleanup — students past this year can be removed in bulk.
                </p>
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-gray-100 pt-5">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <Camera className="h-3 w-3" />
                Reference Photos <span className="text-red-400">*</span>
              </h3>
            </div>

            {/* ── Photo Upload Zone ──────────────────────── */}
            <div
              className={`rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all duration-300 sm:p-8 ${
                isDragActive
                  ? "border-brand-400 bg-brand-50/80 scale-[1.01]"
                  : "border-gray-200 bg-gray-50/50 hover:border-brand-300 hover:bg-gray-50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-blue-50 sm:h-14 sm:w-14">
                <ImageIcon className="h-5 w-5 text-brand-400 sm:h-7 sm:w-7" />
              </div>
              <p className="text-xs font-medium text-gray-700 sm:text-sm">
                <span className="hidden sm:inline">Drag & drop photos here, or </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-semibold text-brand-600 hover:text-brand-700 hover:underline transition-colors"
                >
                  <span className="sm:hidden">Tap to upload photos</span>
                  <span className="hidden sm:inline">browse files</span>
                </button>
              </p>
              <p className="mt-1.5 text-[11px] text-gray-400 sm:text-xs">
                JPG, PNG — Multiple photos improve accuracy
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

            {/* ── Image Previews ─────────────────────────── */}
            {images.length > 0 && (
              <div className="animate-fade-in">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">
                    {images.length} photo{images.length !== 1 ? "s" : ""} selected
                  </p>
                  <button
                    type="button"
                    onClick={clearAllImages}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove all
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
                  {images.map((img) => (
                    <div key={img.id} className="group relative aspect-square animate-scale-in">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl}
                        alt={img.file.name}
                        className="h-full w-full rounded-xl object-cover ring-1 ring-gray-200 transition-all duration-200 group-hover:ring-2 group-hover:ring-brand-300"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1 text-white shadow-md transition-colors hover:bg-red-600 sm:-right-1.5 sm:-top-1.5 sm:hidden sm:group-hover:block"
                        aria-label={`Remove ${img.file.name}`}
                      >
                        <X className="h-3 w-3" />
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
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {isSubmitting ? (
                <>
                  <Upload className="h-5 w-5 animate-spin" />
                  Enrolling Student…
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  Enroll Student
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
