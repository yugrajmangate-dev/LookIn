"""
Pydantic models for strict request and response validation
across all API endpoints.
"""

import datetime as dt
from typing import Dict, List, Optional

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
    
    # Enhanced verification metrics
    detection_confidence_scores: List[float] = Field(default_factory=list)
    match_distances: List[float] = Field(default_factory=list)
    frames_with_faces: int = 0
    frames_without_faces: int = 0
    processing_time_seconds: float = 0.0
    
    def get_verification_stats(self) -> Dict[str, Dict[str, any]]:
        """Return comprehensive verification statistics"""
        return {
            "processing_summary": {
                "total_frames_read": self.total_frames_read,
                "frames_processed": self.frames_processed,
                "processing_time_seconds": round(self.processing_time_seconds, 2),
                "fps_processed": round(self.frames_processed / max(0.1, self.processing_time_seconds), 2)
            },
            "detection_summary": {
                "total_faces_detected": self.faces_detected,
                "frames_with_faces": self.frames_with_faces,
                "frames_without_faces": self.frames_without_faces,
                "avg_faces_per_frame": round(self.faces_detected / max(1, self.frames_processed), 2),
                "detection_rate": round(self.frames_with_faces / max(1, self.frames_processed) * 100, 1)
            },
            "matching_summary": {
                "students_matched": self.students_matched,
                "unknown_faces_saved": self.unknown_faces_saved,
                "match_rate": round(self.students_matched / max(1, self.faces_detected) * 100, 1) if self.faces_detected > 0 else 0,
                "avg_match_distance": round(sum(self.match_distances) / max(1, len(self.match_distances)), 3) if self.match_distances else None,
                "best_match_distance": min(self.match_distances) if self.match_distances else None,
                "worst_match_distance": max(self.match_distances) if self.match_distances else None
            },
            "quality_metrics": {
                "error_count": len(self.errors),
                "error_rate": round(len(self.errors) / max(1, self.frames_processed) * 100, 2),
                "errors": self.errors[:5]  # Show first 5 errors
            }
        }


class CVVerificationRequest(BaseModel):
    """Request to test CV engine with uploaded image."""
    test_type: str = Field(
        description="Type of test: 'detection' (find faces), 'recognition' (match students), 'full' (both)"
    )
    
    
class CVVerificationResult(BaseModel):
    """Detailed results from CV engine testing."""
    test_type: str
    success: bool
    processing_time_ms: float
    faces_found: int
    students_matched: int
    unknown_faces: int
    
    # Detailed detection results
    face_locations: List[List[int]] = Field(default_factory=list, description="Top, right, bottom, left coordinates")
    match_results: List[Dict[str, any]] = Field(default_factory=list)
    detection_confidence: float = 0.0
    
    # Error handling
    errors: List[str] = Field(default_factory=list)
    
    # Performance metrics
    detection_time_ms: float = 0.0
    matching_time_ms: float = 0.0


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


# ──────────────────────────────────────────────
#  Enrolled Students (Admin management)
# ──────────────────────────────────────────────

class EnrolledStudentSummary(BaseModel):
    """Summary of a single enrolled student for the admin panel."""
    student_id: str
    student_name: str
    division: Optional[str] = None
    graduation_year: Optional[int] = None
    encoding_count: int = Field(
        ...,
        description="Number of face encodings stored for this student.",
    )
    registered_at: Optional[dt.datetime] = Field(
        default=None,
        description="Timestamp of the first registered encoding.",
    )


class EnrolledStudentsListResponse(BaseModel):
    """Response listing all enrolled students."""
    success: bool = True
    total_count: int
    students: List[EnrolledStudentSummary]


class DeleteStudentResponse(BaseModel):
    """Response after deleting a student's biometric data."""
    success: bool = True
    message: str
    student_id: str


# ──────────────────────────────────────────────
#  Student Portal (Phase 6)
# ──────────────────────────────────────────────

class StudentAttendanceHistoryResponse(BaseModel):
    """Response containing the full attendance history for a specific student."""
    success: bool = True
    student_id: str
    student_name: str
    division: Optional[str] = None
    total_records: int
    present_count: int
    absent_count: int
    attendance_percentage: float = Field(
        ...,
        description="Percentage of days marked present.",
    )
    records: List[AttendanceRecord]


class StudentVerifyResponse(BaseModel):
    """Response verifying whether a student exists in the biometrics store."""
    success: bool = True
    exists: bool
    student_id: str
    student_name: Optional[str] = None
    division: Optional[str] = None
