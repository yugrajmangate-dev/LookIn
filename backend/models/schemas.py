"""
Pydantic models for strict request and response validation
across all API endpoints.
"""

import datetime as dt
from typing import List, Optional

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
#  Enrollment (Face Onboarding)
# ──────────────────────────────────────────────

class EnrollmentRequest(BaseModel):
    """
    Metadata sent alongside the uploaded image(s) when
    the admin registers or updates a student's face data.
    Passed as form fields (not JSON body) because the
    endpoint also accepts file uploads.
    """
    student_id: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Unique identifier for the student.",
    )
    student_name: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Full name of the student.",
    )
    division: Optional[str] = Field(
        default=None,
        max_length=16,
        description="Class division or section (e.g., 'A', 'B').",
    )
    graduation_year: Optional[int] = Field(
        default=None,
        ge=2000,
        le=2100,
        description="Expected graduation year (e.g. 2027). Used for alumni cleanup.",
    )


class EncodingRecord(BaseModel):
    """A single stored face-encoding entry for a student."""
    encoding: List[float] = Field(
        ...,
        description="128-d face encoding vector.",
    )
    registered_at: dt.datetime = Field(
        ...,
        description="Timestamp when this encoding was captured.",
    )


class StudentBiometricRecord(BaseModel):
    """Complete biometric profile for one student."""
    student_id: str
    student_name: str
    division: Optional[str] = None
    graduation_year: Optional[int] = None
    encodings: List[EncodingRecord] = Field(
        default_factory=list,
        description="One or more face encodings for robust matching.",
    )


class EnrollmentResponse(BaseModel):
    """Structured response returned after a successful enrollment."""
    success: bool
    message: str
    student_id: str
    encodings_stored: int = Field(
        ...,
        description="Total number of encodings stored for this student.",
    )


class ErrorResponse(BaseModel):
    """Structured error response returned on any failure."""
    success: bool = False
    error: str
    detail: Optional[str] = None


# ──────────────────────────────────────────────
#  Attendance
# ──────────────────────────────────────────────

class AttendanceRecord(BaseModel):
    """A single attendance log row."""
    student_id: str
    student_name: str
    division: Optional[str] = None
    date: dt.date
    time: str
    status: str = Field(
        default="present",
        description="Attendance status, e.g. 'present' or 'absent'.",
    )


class DailyRosterResponse(BaseModel):
    """Response containing the full attendance roster for a given day."""
    success: bool = True
    date: dt.date
    total_records: int
    records: List[AttendanceRecord]


# ──────────────────────────────────────────────
#  Video Processing (Phase 2)
# ──────────────────────────────────────────────

class VideoUploadResponse(BaseModel):
    """
    Returned immediately (HTTP 202) when a video is accepted
    for background processing.
    """
    success: bool = True
    message: str
    video_filename: str = Field(
        ...,
        description="Server-side filename of the saved video.",
    )
    job_id: str = Field(
        ...,
        description="Unique job ID for polling processing status.",
    )


class JobStatusResponse(BaseModel):
    """Response from the job-status polling endpoint."""
    status: str = Field(
        ...,
        description="One of: processing, completed, failed.",
    )
    video_filename: Optional[str] = None
    total_frames_read: int = 0
    frames_processed: int = 0
    faces_detected: int = 0
    students_matched: int = 0
    unknown_faces_saved: int = 0
    errors: List[str] = Field(default_factory=list)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None


class UnknownFaceEntry(BaseModel):
    """Represents a single cropped unknown-face image."""
    filename: str = Field(
        ...,
        description="Name of the image file on disk.",
    )
    image_url: str = Field(
        ...,
        description="Publicly accessible URL to retrieve the image.",
    )
    detected_at: Optional[str] = Field(
        default=None,
        description="Timestamp extracted from the filename.",
    )


class UnknownFacesListResponse(BaseModel):
    """Response listing all cropped unknown face images."""
    success: bool = True
    total_count: int
    faces: List[UnknownFaceEntry]


class VideoProcessingResult(BaseModel):
    """
    Summary written to disk when a background video
    processing job completes. (Used internally and
    can be exposed via a future status-polling endpoint.)
    """
    video_filename: str
    total_frames_read: int = 0
    frames_processed: int = 0
    faces_detected: int = 0
    students_matched: int = 0
    unknown_faces_saved: int = 0
    errors: List[str] = Field(default_factory=list)
    completed_at: Optional[dt.datetime] = None


# ──────────────────────────────────────────────
#  Manual Override (Phase 4)
# ──────────────────────────────────────────────

class ManualOverrideRequest(BaseModel):
    """
    Request body for manually marking a student present or absent
    on a specific date — useful when CV recognition misses a face.
    """
    student_id: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="The student's unique identifier.",
    )
    student_name: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Full name of the student.",
    )
    division: Optional[str] = Field(
        default=None,
        max_length=16,
        description="Class division or section.",
    )
    date: dt.date = Field(
        ...,
        description="The attendance date (YYYY-MM-DD).",
    )
    status: str = Field(
        default="present",
        pattern="^(present|absent)$",
        description="Attendance status — 'present' or 'absent'.",
    )


class ManualOverrideResponse(BaseModel):
    """Response returned after a successful manual attendance override."""
    success: bool = True
    message: str
    record: AttendanceRecord


# ──────────────────────────────────────────────
#  Alumni Cleanup (Phase 4)
# ──────────────────────────────────────────────

class AlumniCleanupRequest(BaseModel):
    """
    Request body for bulk-removing graduated students whose
    graduation_year is ≤ the specified cutoff.
    """
    graduation_year_cutoff: int = Field(
        ...,
        ge=2000,
        le=2100,
        description=(
            "Remove students whose graduation_year is less than or equal "
            "to this value. E.g. 2025 removes anyone who graduated in 2025 or earlier."
        ),
    )


class AlumniCleanupResult(BaseModel):
    """Response returned after alumni cleanup completes."""
    success: bool = True
    message: str
    removed_count: int = 0
    removed_student_ids: List[str] = Field(default_factory=list)
