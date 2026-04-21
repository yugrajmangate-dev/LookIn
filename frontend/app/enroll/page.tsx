"use client";

import React, { useState, useRef, useCallback, useEffect, type ChangeEvent } from "react";
import {
  UserPlus,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Trash2,
  Camera,
  Play,
  Square,
  Hash,
  User,
  GraduationCap,
  Layers,
  Mail,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SystemStatusPanel from "@/components/SystemStatusPanel";
import {
  apiUrl,
  type EnrollmentResponse,
  type ErrorResponse,
  type WebcamFaceMatch,
  type WebcamRecognitionResponse,
} from "@/lib/api";

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
  const [email, setEmail] = useState<string>("");
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [consentGiven, setConsentGiven] = useState<boolean>(false);

  /* ── Submission state ────────────────────────── */
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successResult, setSuccessResult] =
    useState<EnrollmentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<string>(
    "Camera idle. Enable to capture face images."
  );
  const [hasCameraAccess, setHasCameraAccess] = useState<boolean>(true);
  const [isCameraRunning, setIsCameraRunning] = useState<boolean>(false);
  const [detectedFaces, setDetectedFaces] = useState<WebcamFaceMatch[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const isCameraRunningRef = useRef<boolean>(false);
  const detectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
          "Please fill in Roll Number, Name, and add at least one photo."
        );
        return;
      }

      if (!consentGiven) {
        setErrorMessage(
          "Consent is required before capturing or submitting biometric data."
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
        setEmail("");
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
    [studentId, studentName, division, graduationYear, images, clearAllImages, consentGiven]
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

  /* ── Webcam capture ─────────────────────────── */
  const drawFaceBoxes = useCallback((matches: WebcamFaceMatch[]) => {
    const canvas = detectionCanvasRef.current;
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

      const boxColor = match.matched ? "#22c55e" : "#ef4444"; // green / red
      context.strokeStyle = boxColor;
      context.lineWidth = Math.max(2, Math.round(width / 320));
      context.strokeRect(left, top, boxWidth, boxHeight);

      // Draw label (student name or unknown) above the box when possible
      const label = match.matched && match.student_name ? `Student: ${match.student_name}` : "Unknown - Not Recognized";
      const fontSize = Math.max(12, Math.round((width / 640) * 14));
      context.font = `${fontSize}px sans-serif`;
      context.textBaseline = "top";
      const textPadding = 6;
      const textWidth = Math.ceil(context.measureText(label).width);
      const labelWidth = textWidth + textPadding * 2;
      const labelHeight = fontSize + 6;
      let labelX = left;
      let labelY = top - labelHeight - 6;
      if (labelY < 0) labelY = top + 6;

      // background for label
      context.fillStyle = "rgba(0, 0, 0, 0.6)";
      context.fillRect(labelX, labelY, labelWidth, labelHeight);

      // label text
      context.fillStyle = "#ffffff";
      context.fillText(label, labelX + textPadding, labelY + 3);
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

    const canvas = captureCanvasRef.current;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(video, 0, 0, width, height);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        "image/jpeg",
        0.9
      );
    });
  }, []);

  const sendFrameForDetection = useCallback(async () => {
    if (inFlightRef.current || !isCameraRunningRef.current) return;

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
        setDetectedFaces([]);
        drawFaceBoxes([]);
        setCameraStatus("Face detection failed. Check the backend connection.");
        return;
      }

      const payload: WebcamRecognitionResponse = await response.json();

      setDetectedFaces(payload.matches);
      drawFaceBoxes(payload.matches);

      if (payload.faces_found === 0) {
        setCameraStatus("No face detected yet. Move closer until a single face is outlined.");
        return;
      }

      if (payload.faces_found > 1) {
        setCameraStatus("Multiple faces detected. Keep only one person in frame before capturing.");
        return;
      }

      const firstFace = payload.matches[0];
      if (firstFace?.matched) {
        setCameraStatus(
          "Face detected. This face already matches an enrolled student. Capture only if you need extra reference photos."
        );
      } else {
        setCameraStatus(
          "Face detected. Capture is enabled for this new student once the box stays steady."
        );
      }
    } catch (error) {
      setDetectedFaces([]);
      drawFaceBoxes([]);
      setCameraStatus(
        error instanceof Error
          ? error.message
          : "Face detection failed. Check network or backend connectivity."
      );
    } finally {
      inFlightRef.current = false;
    }
  }, [captureFrame, drawFaceBoxes]);

  const startCamera = useCallback(async () => {
    if (!consentGiven) {
      setErrorMessage("Please provide consent before enabling the camera.");
      return;
    }

    if (!videoRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setHasCameraAccess(true);
      isCameraRunningRef.current = true;
      setIsCameraRunning(true);
      setDetectedFaces([]);
      drawFaceBoxes([]);
      setCameraStatus("Camera live. Waiting for a single face to be outlined.");

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        void sendFrameForDetection();
      }, 1500);

      void sendFrameForDetection();
    } catch (error) {
      isCameraRunningRef.current = false;
      setHasCameraAccess(false);
      setIsCameraRunning(false);
      setCameraStatus(
        error instanceof Error
          ? error.message
          : "Unable to access camera. Check permissions."
      );
    }
  }, [consentGiven, drawFaceBoxes, sendFrameForDetection]);

  const stopCamera = useCallback(() => {
    isCameraRunningRef.current = false;

    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    const canvas = detectionCanvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }

    setIsCameraRunning(false);
    setDetectedFaces([]);
    setCameraStatus("Camera stopped. You can start again anytime.");
  }, []);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !isCameraRunning) return;

    if (detectedFaces.length !== 1) {
      setErrorMessage("Capture is available only when one face is outlined in the preview.");
      return;
    }

    setErrorMessage(null);

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement("canvas");
    }

    const canvas = captureCanvasRef.current;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      const previewUrl = URL.createObjectURL(blob);
      setImages((previous) => [
        ...previous,
        {
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          previewUrl,
        },
      ]);
    }, "image/jpeg", 0.9);
  }, [detectedFaces.length, isCameraRunning]);

  useEffect(() => {
    return () => {
      isCameraRunningRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  /* ── Render ──────────────────────────────────── */
  return (
    <div>
      <PageHeader
        title="Enroll Student"
        description="Register a new student by providing their details and uploading reference photos for face recognition."
      />

      <SystemStatusPanel cameraState={isCameraRunning ? "granted" : hasCameraAccess ? "idle" : "denied"} />

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
                  Roll Number <span className="text-red-400">*</span>
                </label>
                <input
                  id="studentId"
                  type="text"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  autoComplete="off"
                  placeholder="e.g. CS2025-042"
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
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="studentName"
                  type="text"
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  autoComplete="name"
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
                  Department
                </label>
                <input
                  id="division"
                  type="text"
                  value={division}
                  onChange={(event) => setDivision(event.target.value)}
                  autoComplete="organization"
                  placeholder="e.g. Computer Science (optional)"
                  className="input-field"
                />
              </div>

              <div>
                <label
                  htmlFor="graduationYear"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  <GraduationCap className="h-3 w-3" />
                  Year
                </label>
                <input
                  id="graduationYear"
                  type="number"
                  value={graduationYear}
                  onChange={(event) => setGraduationYear(event.target.value)}
                  autoComplete="off"
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

            {/* Row 3: Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider"
              >
                <Mail className="h-3 w-3" />
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="e.g. student@college.edu (optional)"
                className="input-field"
              />
            </div>

            {/* Separator */}
            <div className="border-t border-gray-100 pt-5">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <Camera className="h-3 w-3" />
                Reference Photos <span className="text-red-400">*</span>
              </h3>
              <label htmlFor="consent-biometric" className="mt-3 flex items-start gap-2 text-xs text-gray-600">
                <input
                  id="consent-biometric"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600"
                  checked={consentGiven}
                  onChange={(event) => setConsentGiven(event.target.checked)}
                />
                I consent to capture and store my biometric data for attendance.
              </label>
            </div>

            {/* Camera preview + capture */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.2fr_0.8fr]">
              <div className="card-elevated overflow-hidden border border-dashed border-gray-200 bg-gray-50/60">
                <div className="relative aspect-[4/3] min-h-[220px] overflow-hidden">
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    autoPlay
                    playsInline
                    muted
                    aria-label="Camera preview for capturing face images"
                  />
                  <canvas
                    ref={detectionCanvasRef}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    aria-hidden="true"
                  />
                  {isCameraRunning && (
                    <div className="absolute left-3 top-3 rounded-full bg-gray-900/75 px-3 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur">
                      {detectedFaces.length === 0
                        ? "Waiting for face"
                        : detectedFaces.length === 1
                          ? "Face detected"
                          : `${detectedFaces.length} faces detected`}
                    </div>
                  )}
                  {isCameraRunning && detectedFaces.length === 1 && (
                    <div className="absolute bottom-3 left-3 rounded-full bg-emerald-600/90 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                      Capture enabled
                    </div>
                  )}
                  {!isCameraRunning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white">
                        <Camera className="h-7 w-7 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Camera Preview</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Enable the camera to capture face images
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-600">
                  {!hasCameraAccess && (
                    <div className="flex items-start gap-2 text-amber-600">
                      <AlertCircle className="mt-0.5 h-4 w-4" />
                      <span>Camera access denied. Please allow permissions.</span>
                    </div>
                  )}
                  <p className="mt-1">{cameraStatus}</p>
                </div>
              </div>
              <div className="card-elevated flex flex-col items-center justify-center gap-3 p-6 text-center">
                <button
                  type="button"
                  className="btn-primary w-full justify-center"
                  onClick={startCamera}
                  disabled={isCameraRunning}
                >
                  <Play className="h-4 w-4" />
                  Start Camera
                </button>
                <button
                  type="button"
                  className="btn-secondary w-full justify-center"
                  onClick={capturePhoto}
                  disabled={!isCameraRunning || detectedFaces.length !== 1}
                >
                  <Camera className="h-4 w-4" />
                  Capture Photo
                </button>
                <button
                  type="button"
                  className="btn-secondary w-full justify-center"
                  onClick={stopCamera}
                  disabled={!isCameraRunning}
                >
                  <Square className="h-4 w-4" />
                  Stop Camera
                </button>
                <p className="text-xs text-gray-500">
                  {isCameraRunning
                    ? detectedFaces.length === 0
                      ? "Capture stays disabled until a single face is outlined."
                      : detectedFaces.length > 1
                        ? "Keep only one face in frame before capturing."
                        : "Face framed. You can capture this photo now."
                    : "Capture 3-5 clear photos"}
                </p>
              </div>
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
                aria-label="Upload reference photos"
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
