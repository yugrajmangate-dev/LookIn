"""
Admin Face Onboarding API
==========================
Provides a POST endpoint for the administrator to register (or update)
a student's face encodings.

Key behaviours:
- Accepts one or more image uploads alongside student metadata.
- Extracts 128-d face encodings via ``face_recognition``.
- Supports **multiple encodings per student** for improved accuracy.
- Persists data to a local ``students_biometrics.json`` file.
- Returns structured JSON responses on success and failure.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Dict, List

import face_recognition
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from config import settings
from models.schemas import (
    EncodingRecord,
    EnrollmentResponse,
    ErrorResponse,
    StudentBiometricRecord,
)

router = APIRouter(prefix="/enroll", tags=["Enrollment"])

# ──────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────


def _load_biometrics_store() -> Dict[str, StudentBiometricRecord]:
    """
    Load the biometrics JSON file and return a dict keyed by student_id.
    Creates an empty file / directory if they don't exist yet.
    """
    biometrics_path = settings.biometrics_path
    biometrics_path.parent.mkdir(parents=True, exist_ok=True)

    if not biometrics_path.exists() or biometrics_path.stat().st_size == 0:
        biometrics_path.write_text("{}", encoding="utf-8")
        return {}

    raw_data: dict = json.loads(biometrics_path.read_text(encoding="utf-8"))

    store: Dict[str, StudentBiometricRecord] = {}
    for student_id, record_dict in raw_data.items():
        store[student_id] = StudentBiometricRecord(**record_dict)

    return store


def _save_biometrics_store(store: Dict[str, StudentBiometricRecord]) -> None:
    """Persist the full biometrics store to JSON."""
    biometrics_path = settings.biometrics_path

    serialisable: dict = {}
    for student_id, record in store.items():
        serialisable[student_id] = record.model_dump(mode="json")

    biometrics_path.write_text(
        json.dumps(serialisable, indent=2, default=str),
        encoding="utf-8",
    )


async def _extract_face_encodings(image_file: UploadFile) -> List[np.ndarray]:
    """
    Read an uploaded image and return all face encodings found in it.

    Args:
        image_file: The uploaded image file.

    Returns:
        A list of 128-d numpy arrays (one per face detected).

    Raises:
        ValueError: If the image cannot be read or no faces are found.
    """
    contents = await image_file.read()

    # Decode image bytes into a numpy array via OpenCV-compatible route
    image_array = np.frombuffer(contents, dtype=np.uint8)

    # face_recognition expects an RGB numpy image
    import cv2
    decoded_image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if decoded_image is None:
        raise ValueError(
            f"Could not decode image file '{image_file.filename}'. "
            "Ensure it is a valid JPEG or PNG."
        )

    # Convert BGR (OpenCV default) → RGB (face_recognition expects RGB)
    rgb_image = cv2.cvtColor(decoded_image, cv2.COLOR_BGR2RGB)

    face_encodings = face_recognition.face_encodings(rgb_image)

    if not face_encodings:
        raise ValueError(
            f"No faces detected in '{image_file.filename}'. "
            "Please upload a clear, well-lit photo."
        )

    return face_encodings


# ──────────────────────────────────────────────
#  Endpoint
# ──────────────────────────────────────────────


@router.post(
    "/",
    response_model=EnrollmentResponse,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Register or update a student's face encodings",
    description=(
        "Accepts one or more face images plus student metadata. "
        "Extracts 128-d face encodings and stores them in the "
        "biometrics JSON file, supporting multiple encodings per student."
    ),
)
async def enroll_student(
    student_id: str = Form(
        ...,
        min_length=1,
        max_length=64,
        description="Unique student identifier.",
    ),
    student_name: str = Form(
        ...,
        min_length=1,
        max_length=128,
        description="Full name of the student.",
    ),
    division: str | None = Form(
        default=None,
        max_length=16,
        description="Class division or section.",
    ),
    graduation_year: int | None = Form(
        default=None,
        ge=2000,
        le=2100,
        description="Expected graduation year (e.g. 2027). Used for alumni cleanup.",
    ),
    images: List[UploadFile] = File(
        ...,
        description=(
            "One or more face images (JPEG/PNG). Multiple images improve "
            "recognition accuracy."
        ),
    ),
) -> EnrollmentResponse:
    """
    **Admin-only** endpoint to register a new student or append
    additional face encodings to an existing student record.

    Workflow:
    1. Validate that at least one image is provided.
    2. For each image, extract all detected face encodings.
    3. Load the existing biometric store.
    4. Append the new encodings to the student's record.
    5. Persist the updated store and return a success response.
    """
    # ── Validate upload count ────────────────────────────────────
    if not images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error="No images provided",
                detail="At least one face image is required for enrollment.",
            ).model_dump(),
        )

    # ── Validate file sizes ──────────────────────────────────────
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    for image_file in images:
        # Read size by seeking (we'll reset for later reading)
        content_peek = await image_file.read()
        if len(content_peek) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ErrorResponse(
                    error="File too large",
                    detail=(
                        f"'{image_file.filename}' exceeds the "
                        f"{settings.max_upload_size_mb} MB limit."
                    ),
                ).model_dump(),
            )
        # Reset the file pointer so _extract_face_encodings can read it
        await image_file.seek(0)

    # ── Extract encodings from every uploaded image ──────────────
    new_encoding_records: List[EncodingRecord] = []
    registration_timestamp = datetime.now(tz=timezone.utc)

    for image_file in images:
        try:
            face_encodings = await _extract_face_encodings(image_file)
        except ValueError as extraction_error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ErrorResponse(
                    error="Face extraction failed",
                    detail=str(extraction_error),
                ).model_dump(),
            )

        for encoding_array in face_encodings:
            new_encoding_records.append(
                EncodingRecord(
                    encoding=encoding_array.tolist(),
                    registered_at=registration_timestamp,
                )
            )

    # ── Persist to biometrics store ──────────────────────────────
    try:
        biometrics_store = _load_biometrics_store()
    except Exception as load_error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                error="Storage read error",
                detail=f"Failed to load biometric store: {load_error}",
            ).model_dump(),
        )

    if student_id in biometrics_store:
        # Append new encodings to the existing record
        existing_record = biometrics_store[student_id]
        existing_record.student_name = student_name  # Allow name updates
        existing_record.division = division
        if graduation_year is not None:
            existing_record.graduation_year = graduation_year
        existing_record.encodings.extend(new_encoding_records)
    else:
        # Create a brand-new record
        biometrics_store[student_id] = StudentBiometricRecord(
            student_id=student_id,
            student_name=student_name,
            division=division,
            graduation_year=graduation_year,
            encodings=new_encoding_records,
        )

    try:
        _save_biometrics_store(biometrics_store)
    except Exception as save_error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                error="Storage write error",
                detail=f"Failed to save biometric store: {save_error}",
            ).model_dump(),
        )

    total_encodings = len(biometrics_store[student_id].encodings)

    return EnrollmentResponse(
        success=True,
        message=(
            f"Successfully enrolled {len(new_encoding_records)} new encoding(s) "
            f"for student '{student_name}' ({student_id})."
        ),
        student_id=student_id,
        encodings_stored=total_encodings,
    )
