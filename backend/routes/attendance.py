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

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)

from config import settings
from models.schemas import (
    AttendanceRecord,
    DailyRosterResponse,
    ErrorResponse,
    JobStatusResponse,
    ManualOverrideRequest,
    ManualOverrideResponse,
    UnknownFaceEntry,
    UnknownFacesListResponse,
    VideoUploadResponse,
)
from utils.csv_handler import fetch_daily_roster, manual_override_attendance
from utils.vision_engine import process_video

router = APIRouter(prefix="/attendance", tags=["Attendance"])

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
    Scan the ``unknown_faces`` directory and return metadata for
    each image found.
    """
    unknown_faces_directory = settings.unknown_faces_dir

    if not unknown_faces_directory.exists():
        return UnknownFacesListResponse(
            success=True,
            total_count=0,
            faces=[],
        )

    allowed_image_extensions = {".jpg", ".jpeg", ".png", ".bmp"}

    face_entries: List[UnknownFaceEntry] = []

    # Sort by filename (which includes timestamp) for chronological order
    sorted_files = sorted(unknown_faces_directory.iterdir())

    for file_path in sorted_files:
        if (
            file_path.is_file()
            and file_path.suffix.lower() in allowed_image_extensions
        ):
            # Extract timestamp from filename pattern:
            #   unknown_YYYYMMDD_HHMMSS_<index>.jpg
            detected_at_string = _extract_timestamp_from_filename(file_path.name)

            face_entries.append(
                UnknownFaceEntry(
                    filename=file_path.name,
                    image_url=f"/static/unknown_faces/{file_path.name}",
                    detected_at=detected_at_string,
                )
            )

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
