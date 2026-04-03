"""
Attendance Router
=================
Endpoints for video-based batch attendance processing
and unknown face review.

Endpoints:
    POST /upload-video     — Accept a class video, trigger background processing.
    GET  /unknown-faces    — List all cropped unknown face images.
    GET  /daily-roster     — Fetch the attendance roster for a given date.
    GET  /job-status/{id}  — Poll the processing status of an upload job.
"""

from __future__ import annotations

import json
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional
import re

import io

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse

from config import settings
from models.schemas import (
    AttendanceRecord,
    DailyRosterResponse,
    ErrorResponse,
    JobStatusResponse,
    ManualOverrideRequest,
    ManualOverrideResponse,
    StudentAttendanceHistoryResponse,
    UnknownFaceEntry,
    UnknownFacesListResponse,
    VideoUploadResponse,
    WebcamFaceMatch,
    WebcamRecognitionResponse,
)
from utils.csv_handler import fetch_daily_roster, manual_override_attendance
from utils.storage import list_unknown_face_images, load_attendance_df, load_biometrics_raw
from utils.vision_engine import process_video

import time
from typing import Dict

import numpy as np
import face_recognition
from PIL import Image

router = APIRouter(prefix="/attendance", tags=["Attendance"])

IRN_PATTERN = re.compile(r"^CS24(0[1-9]|[1-8][0-9]|90)$", re.IGNORECASE)

# Allowed video MIME types
ALLOWED_VIDEO_CONTENT_TYPES = {
    "video/mp4",
    "video/mpeg",
    "video/x-msvideo",   # .avi
    "video/quicktime",    # .mov
    "video/x-matroska",   # .mkv
    "video/webm",
    "video/x-m4v",
    "video/3gpp",
    "application/octet-stream",  # fallback: some browsers send this
}

# Extension-based fallback for content-type validation
ALLOWED_VIDEO_EXTENSIONS = {
    ".mp4", ".mpeg", ".mpg", ".avi", ".mov",
    ".mkv", ".webm", ".m4v", ".3gp", ".wmv",
}


# ──────────────────────────────────────────────
#  Job Tracking Helpers
# ──────────────────────────────────────────────

def _load_jobs() -> dict:
    """Load the processing jobs JSON file."""
    jobs_path = settings.jobs_path
    if not jobs_path.exists() or jobs_path.stat().st_size == 0:
        return {}
    return json.loads(jobs_path.read_text(encoding="utf-8"))


def _save_job(job_id: str, job_data: dict) -> None:
    """Save or update a single job in the jobs store."""
    jobs_path = settings.jobs_path
    jobs_path.parent.mkdir(parents=True, exist_ok=True)
    all_jobs = _load_jobs()
    all_jobs[job_id] = job_data
    jobs_path.write_text(json.dumps(all_jobs, indent=2, default=str), encoding="utf-8")


def _run_and_track(job_id: str, video_path: str) -> None:
    """Wrapper that runs process_video and persists the result."""
    _save_job(job_id, {
        "status": "processing",
        "started_at": datetime.now().isoformat(),
        "video_filename": Path(video_path).name,
    })
    try:
        result = process_video(video_path)
        _save_job(job_id, {
            "status": "completed",
            "video_filename": result.video_filename,
            "total_frames_read": result.total_frames_read,
            "frames_processed": result.frames_processed,
            "faces_detected": result.faces_detected,
            "students_matched": result.students_matched,
            "unknown_faces_saved": result.unknown_faces_saved,
            "errors": result.errors,
            "completed_at": (result.completed_at or datetime.now()).isoformat(),
        })
    except Exception as exc:
        _save_job(job_id, {
            "status": "failed",
            "error": str(exc),
            "completed_at": datetime.now().isoformat(),
        })


# ──────────────────────────────────────────────
#  POST /upload-video
# ──────────────────────────────────────────────


@router.post(
    "/upload-video",
    response_model=VideoUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        400: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Upload a class video for batch attendance processing",
    description=(
        "Accepts a video file, saves it to temporary storage, and "
        "triggers the OpenCV face-recognition pipeline as a background "
        "task. Returns immediately with HTTP 202."
    ),
)
async def upload_video_for_processing(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(
        ...,
        description="A class video file (MP4, AVI, MOV, MKV, or WebM).",
    ),
) -> VideoUploadResponse:
    """
    **Admin-only** endpoint to initiate batch video processing.

    Workflow:
    1. Validate the upload (content type, file size).
    2. Save the video to a temporary directory.
    3. Enqueue ``process_video()`` as a FastAPI ``BackgroundTask``.
    4. Return HTTP 202 immediately.
    """

    # ── Validate content type (with extension fallback) ────────
    file_extension = (Path(video.filename).suffix.lower() if video.filename else "")
    content_type_ok = video.content_type in ALLOWED_VIDEO_CONTENT_TYPES
    extension_ok = file_extension in ALLOWED_VIDEO_EXTENSIONS

    if not content_type_ok and not extension_ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error="Invalid file type",
                detail=(
                    f"Content type '{video.content_type}' and extension "
                    f"'{file_extension}' are not supported. "
                    f"Allowed formats: MP4, AVI, MOV, MKV, WebM."
                ),
            ).model_dump(),
        )

    # ── Read and validate file size ──────────────────────────────
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    video_bytes = await video.read()

    if len(video_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=ErrorResponse(
                error="File too large",
                detail=(
                    f"Uploaded video is {len(video_bytes) / (1024 * 1024):.1f} MB "
                    f"but the limit is {settings.max_upload_size_mb} MB."
                ),
            ).model_dump(),
        )

    if len(video_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error="Empty file",
                detail="The uploaded video file is empty.",
            ).model_dump(),
        )

    # ── Save to temporary directory ──────────────────────────────
    temp_video_directory = settings.temp_video_dir
    temp_video_directory.mkdir(parents=True, exist_ok=True)

    # Generate a unique filename to avoid collisions
    original_extension = Path(video.filename).suffix if video.filename else ".mp4"
    unique_video_filename = (
        f"upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        f"_{uuid.uuid4().hex[:8]}{original_extension}"
    )
    saved_video_path = temp_video_directory / unique_video_filename

    try:
        saved_video_path.write_bytes(video_bytes)
    except OSError as write_error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                error="File save error",
                detail=f"Could not save video to disk: {write_error}",
            ).model_dump(),
        )

    # ── Trigger background processing ────────────────────────────
    job_id = uuid.uuid4().hex[:12]
    background_tasks.add_task(_run_and_track, job_id, str(saved_video_path))

    return VideoUploadResponse(
        success=True,
        message=(
            "Video uploaded successfully. Face recognition processing "
            "has started in the background."
        ),
        video_filename=unique_video_filename,
        job_id=job_id,
    )


# ──────────────────────────────────────────────
#  GET /job-status/{job_id}
# ──────────────────────────────────────────────


@router.get(
    "/job-status/{job_id}",
    response_model=JobStatusResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Poll the processing status of an upload job",
)
async def get_job_status(job_id: str) -> JobStatusResponse:
    """Return the current status of a background video processing job."""
    all_jobs = _load_jobs()
    job = all_jobs.get(job_id)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error="Job not found",
                detail=f"No job exists with ID '{job_id}'.",
            ).model_dump(),
        )

    return JobStatusResponse(**job)


# ──────────────────────────────────────────────
#  GET /unknown-faces
# ──────────────────────────────────────────────


@router.get(
    "/unknown-faces",
    response_model=UnknownFacesListResponse,
    responses={500: {"model": ErrorResponse}},
    summary="List all cropped unknown face images",
    description=(
        "Returns the filenames and public URLs of every cropped "
        "unknown-face image saved during video processing, "
        "so the frontend can display them for manual review."
    ),
)
async def list_unknown_faces() -> UnknownFacesListResponse:
    """
    Return metadata for every unknown-face image, sourced from
    Supabase Storage (production) or the local filesystem (dev).
    """
    images = list_unknown_face_images()
    face_entries: List[UnknownFaceEntry] = [
        UnknownFaceEntry(
            filename=img["filename"],
            image_url=img["image_url"],
            detected_at=_extract_timestamp_from_filename(img["filename"]),
        )
        for img in images
    ]

    return UnknownFacesListResponse(
        success=True,
        total_count=len(face_entries),
        faces=face_entries,
    )


def _extract_timestamp_from_filename(filename: str) -> Optional[str]:
    """
    Attempt to parse a timestamp from filenames like
    ``unknown_20250610_143025_0.jpg``.

    Returns:
        An ISO-formatted datetime string, or ``None`` if parsing fails.
    """
    try:
        # Remove extension, then split by underscore
        stem = Path(filename).stem  # e.g. "unknown_20250610_143025_0"
        parts = stem.split("_")
        if len(parts) >= 3:
            date_string = parts[1]  # "20250610"
            time_string = parts[2]  # "143025"
            parsed_datetime = datetime.strptime(
                f"{date_string}{time_string}", "%Y%m%d%H%M%S"
            )
            return parsed_datetime.isoformat()
    except (ValueError, IndexError):
        pass
    return None


# ──────────────────────────────────────────────
#  POST /webcam-frame
# ──────────────────────────────────────────────


@router.post(
    "/webcam-frame",
    response_model=WebcamRecognitionResponse,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Recognize faces from a single webcam frame",
    description=(
        "Accepts a single image frame (JPEG/PNG) from the live webcam feed, "
        "detects faces, and matches them against enrolled students."
    ),
)
async def recognize_webcam_frame(
    frame: UploadFile = File(..., description="Webcam frame image (JPEG/PNG)."),
) -> WebcamRecognitionResponse:
    """
    Process one webcam frame and return face matches without
    writing attendance. Use the attendance endpoint for marking.
    """
    start_time = time.time()

    if not frame.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error="No image provided",
                detail="A webcam frame image is required.",
            ).model_dump(),
        )

    try:
        frame_bytes = await frame.read()
        if len(frame_bytes) == 0:
            raise ValueError("Empty image file.")

        pil_image = Image.open(io.BytesIO(frame_bytes))
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")
        image_array = np.array(pil_image)
    except Exception as image_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error="Invalid image",
                detail=f"Unable to read frame: {image_error}",
            ).model_dump(),
        )

    try:
        face_locations = face_recognition.face_locations(
            image_array,
            number_of_times_to_upsample=1,
            model="hog",
        )
        face_encodings = face_recognition.face_encodings(
            image_array,
            face_locations,
            num_jitters=1,
        )
    except Exception as detection_error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                error="Face detection failed",
                detail=str(detection_error),
            ).model_dump(),
        )

    biometrics_store = load_biometrics_raw()
    known_encodings: list[np.ndarray] = []
    known_students: list[Dict[str, Optional[str]]] = []

    for student_id, record_dict in biometrics_store.items():
        encodings = record_dict.get("encodings", [])
        for encoding_entry in encodings:
            known_encodings.append(np.array(encoding_entry.get("encoding"), dtype=np.float64))
            known_students.append(
                {
                    "student_id": student_id,
                    "student_name": record_dict.get("student_name"),
                    "division": record_dict.get("division"),
                }
            )

    matches: list[WebcamFaceMatch] = []
    students_matched = 0
    unknown_faces = 0

    for index, (encoding, location) in enumerate(zip(face_encodings, face_locations)):
        match_entry = WebcamFaceMatch(
            face_index=index,
            face_location=[int(coord) for coord in location],
            matched=False,
        )

        if known_encodings:
            distances = face_recognition.face_distance(known_encodings, encoding)
            best_match_index = int(np.argmin(distances))
            best_distance = float(distances[best_match_index])
            match_entry.distance = round(best_distance, 3)
            match_entry.confidence = round((1 - best_distance) * 100, 1)

            if best_distance <= settings.face_match_threshold:
                match_entry.matched = True
                match_entry.student_id = known_students[best_match_index]["student_id"]
                match_entry.student_name = known_students[best_match_index]["student_name"]
                match_entry.division = known_students[best_match_index]["division"]
                students_matched += 1
            else:
                unknown_faces += 1
        else:
            unknown_faces += 1

        matches.append(match_entry)

    processing_time_ms = (time.time() - start_time) * 1000

    return WebcamRecognitionResponse(
        success=True,
        faces_found=len(face_locations),
        students_matched=students_matched,
        unknown_faces=unknown_faces,
        processing_time_ms=processing_time_ms,
        matches=matches,
    )


# ──────────────────────────────────────────────
#  GET /daily-roster
# ──────────────────────────────────────────────


@router.get(
    "/daily-roster",
    response_model=DailyRosterResponse,
    responses={400: {"model": ErrorResponse}},
    summary="Get the attendance roster for a specific date",
    description=(
        "Returns all attendance records for the requested date. "
        "Defaults to today if no date query parameter is provided."
    ),
)
async def get_daily_roster(
    target_date: Optional[str] = Query(
        default=None,
        alias="date",
        description="Date in YYYY-MM-DD format. Defaults to today.",
        examples=["2025-06-10"],
    ),
) -> DailyRosterResponse:
    """
    Fetch the full attendance roster for a given day from the CSV.
    """
    roster_date: date

    if target_date:
        try:
            roster_date = date.fromisoformat(target_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ErrorResponse(
                    error="Invalid date format",
                    detail=(
                        f"'{target_date}' is not valid. "
                        "Please use YYYY-MM-DD format."
                    ),
                ).model_dump(),
            )
    else:
        roster_date = date.today()

    records: List[AttendanceRecord] = fetch_daily_roster(
        target_date=roster_date
    )

    return DailyRosterResponse(
        date=roster_date,
        total_records=len(records),
        records=records,
    )


# ──────────────────────────────────────────────
#  POST /manual-override
# ──────────────────────────────────────────────


@router.post(
    "/manual-override",
    response_model=ManualOverrideResponse,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Manually mark a student present or absent",
    description=(
        "Allows the administrator to manually add an attendance record "
        "for a specific student and date. Useful when face recognition "
        "misses someone or for retroactive corrections."
    ),
)
async def manual_attendance_override(
    payload: ManualOverrideRequest,
) -> ManualOverrideResponse:
    """
    **Admin-only** endpoint for manual attendance entry.

    Workflow:
    1. Validate the incoming request body.
    2. Delegate to ``manual_override_attendance()`` which handles
       duplicate detection (updates status if existing, inserts if new).
    3. Return the written / updated ``AttendanceRecord``.
    """
    try:
        record = manual_override_attendance(
            student_id=payload.student_id,
            student_name=payload.student_name,
            division=payload.division,
            target_date=payload.date,
            status=payload.status,
        )
    except Exception as write_error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                error="Override failed",
                detail=f"Could not write attendance record: {write_error}",
            ).model_dump(),
        )

    return ManualOverrideResponse(
        success=True,
        message=(
            f"Student '{payload.student_name}' ({payload.student_id}) "
            f"marked as {payload.status} for {payload.date}."
        ),
        record=record,
    )


# ──────────────────────────────────────────────
#  GET /export-csv
# ──────────────────────────────────────────────


@router.get(
    "/export-csv",
    summary="Download attendance records as a CSV file",
    description=(
        "Returns the full attendance log (or a single-date slice) as a "
        "downloadable CSV file. Optionally filter by date using the "
        "?date=YYYY-MM-DD query parameter."
    ),
    responses={400: {"model": ErrorResponse}},
)
async def export_attendance_csv(
    target_date: Optional[str] = Query(
        default=None,
        alias="date",
        description="Filter to a specific date (YYYY-MM-DD). Omit for all records.",
    ),
) -> StreamingResponse:
    """Stream the attendance CSV to the browser as a file download."""
    df = load_attendance_df()

    if target_date:
        try:
            date.fromisoformat(target_date)  # validate format
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ErrorResponse(
                    error="Invalid date format",
                    detail=f"'{target_date}' is not valid. Use YYYY-MM-DD.",
                ).model_dump(),
            )
        df = df[df["date"] == target_date]
        filename = f"attendance_{target_date}.csv"
    else:
        filename = "attendance_logs.csv"

    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ──────────────────────────────────────────────
#  GET /student/{student_id}  (Phase 6 — Student Portal)
# ──────────────────────────────────────────────


@router.get(
    "/student/{student_id}",
    response_model=StudentAttendanceHistoryResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Get full attendance history for a specific student",
    description=(
        "Returns all attendance records for a given student across all dates. "
        "Used by the student portal to display their personal attendance history."
    ),
)
async def get_student_attendance(student_id: str) -> StudentAttendanceHistoryResponse:
    """
    Fetch the complete attendance history for a single student.

    The student must exist in the biometrics store for name/division lookup.
    Returns attendance percentage and all records sorted by date descending.
    """
    # Verify student exists in biometrics
    biometrics = load_biometrics_raw()
    normalized_student_id = student_id.strip().upper()
    student_data = biometrics.get(normalized_student_id)

    if not student_data:
        if IRN_PATTERN.fullmatch(normalized_student_id):
            return StudentAttendanceHistoryResponse(
                student_id=normalized_student_id,
                student_name=f"Student {normalized_student_id}",
                division="Computer Science",
                total_records=0,
                present_count=0,
                absent_count=0,
                attendance_percentage=0.0,
                records=[],
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error="Student not found",
                detail=f"No student with ID '{normalized_student_id}' is enrolled in the system.",
            ).model_dump(),
        )

    student_name = student_data.get("student_name", "Unknown")
    division = student_data.get("division")

    # Load attendance and filter by student_id
    df = load_attendance_df()

    if df.empty:
        return StudentAttendanceHistoryResponse(
            student_id=normalized_student_id,
            student_name=student_name,
            division=division,
            total_records=0,
            present_count=0,
            absent_count=0,
            attendance_percentage=0.0,
            records=[],
        )

    student_df = df[df["student_id"] == normalized_student_id].copy()

    if student_df.empty:
        return StudentAttendanceHistoryResponse(
            student_id=normalized_student_id,
            student_name=student_name,
            division=division,
            total_records=0,
            present_count=0,
            absent_count=0,
            attendance_percentage=0.0,
            records=[],
        )

    # Sort by date descending (most recent first)
    student_df = student_df.sort_values(by="date", ascending=False)

    # Calculate stats
    total_records = len(student_df)
    present_count = len(student_df[student_df["status"].str.lower() == "present"])
    absent_count = total_records - present_count
    attendance_percentage = (present_count / total_records * 100) if total_records > 0 else 0.0

    # Convert to AttendanceRecord objects
    records: List[AttendanceRecord] = []
    for _, row in student_df.iterrows():
        records.append(
            AttendanceRecord(
                student_id=row["student_id"],
                student_name=row["student_name"],
                division=row.get("division"),
                date=date.fromisoformat(row["date"]),
                time=row["time"],
                status=row["status"],
            )
        )

    return StudentAttendanceHistoryResponse(
        student_id=normalized_student_id,
        student_name=student_name,
        division=division,
        total_records=total_records,
        present_count=present_count,
        absent_count=absent_count,
        attendance_percentage=round(attendance_percentage, 1),
        records=records,
    )
