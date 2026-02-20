"""
Vision Engine — Background Video Processing
============================================
Core utility module that processes an uploaded class video.

Workflow (per ARCHITECTURE.md §3B):
1.  Open the video with ``cv2.VideoCapture``.
2.  Calculate a *frame skip* so we only analyse
    ``FRAMES_PER_SECOND_TO_PROCESS`` frames per real-time second.
3.  For each sampled frame:
    a. Detect faces and extract 128-d encodings via ``face_recognition``.
    b. Compare every detected encoding against **all** registered
       students in ``students_biometrics.json``.
    c. **Match** (Euclidean distance ≤ threshold) →
       call ``mark_student_present()``.
    d. **Unknown** (distance > threshold for every student) →
       crop the face with NumPy slicing and save it to
       ``/data/unknown_faces/``.
4.  Clean up the temporary video file when done.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import face_recognition
import numpy as np

from config import settings
from models.schemas import (
    EncodingRecord,
    StudentBiometricRecord,
    VideoProcessingResult,
)
from utils.csv_handler import mark_student_present

logger = logging.getLogger("vision_engine")
logger.setLevel(logging.INFO)


# ──────────────────────────────────────────────
#  Biometrics Loader
# ──────────────────────────────────────────────


def _load_known_encodings() -> Tuple[
    List[np.ndarray],
    List[str],
    List[str],
    List[Optional[str]],
]:
    """
    Load the biometric store and flatten every encoding into
    parallel lists for efficient batch comparison.

    Returns:
        known_face_encodings  – list of 128-d numpy arrays
        known_student_ids     – parallel list of student IDs
        known_student_names   – parallel list of student names
        known_divisions       – parallel list of divisions (may be None)
    """
    biometrics_path = settings.biometrics_path

    if not biometrics_path.exists() or biometrics_path.stat().st_size == 0:
        return [], [], [], []

    raw_data: dict = json.loads(biometrics_path.read_text(encoding="utf-8"))

    known_face_encodings: List[np.ndarray] = []
    known_student_ids: List[str] = []
    known_student_names: List[str] = []
    known_divisions: List[Optional[str]] = []

    for student_id, record_dict in raw_data.items():
        record = StudentBiometricRecord(**record_dict)
        for encoding_entry in record.encodings:
            known_face_encodings.append(
                np.array(encoding_entry.encoding, dtype=np.float64)
            )
            known_student_ids.append(record.student_id)
            known_student_names.append(record.student_name)
            known_divisions.append(record.division)

    return (
        known_face_encodings,
        known_student_ids,
        known_student_names,
        known_divisions,
    )


# ──────────────────────────────────────────────
#  Crop & Save Unknown Face
# ──────────────────────────────────────────────


def _save_unknown_face(
    frame_rgb: np.ndarray,
    face_location: Tuple[int, int, int, int],
    output_directory: Path,
    face_index: int,
) -> Optional[str]:
    """
    Crop the face region from the frame using NumPy slicing and save
    it as a JPEG to *output_directory*.

    ``face_location`` is in ``face_recognition``'s format:
        (top, right, bottom, left)

    Returns:
        The filename of the saved image, or ``None`` if saving fails.
    """
    top, right, bottom, left = face_location

    # Ensure coordinates are within frame bounds
    height, width = frame_rgb.shape[:2]
    top = max(0, top)
    left = max(0, left)
    bottom = min(height, bottom)
    right = min(width, right)

    # NumPy slicing to crop the face (per ARCHITECTURE.md)
    cropped_face_rgb = frame_rgb[top:bottom, left:right]

    if cropped_face_rgb.size == 0:
        logger.warning("Cropped face has zero area — skipping save.")
        return None

    # Convert RGB → BGR for OpenCV imwrite
    cropped_face_bgr = cv2.cvtColor(cropped_face_rgb, cv2.COLOR_RGB2BGR)

    timestamp_string = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"unknown_{timestamp_string}_{face_index}.jpg"
    output_path = output_directory / filename

    success = cv2.imwrite(str(output_path), cropped_face_bgr)
    if not success:
        logger.error("cv2.imwrite failed for %s", output_path)
        return None

    return filename


# ──────────────────────────────────────────────
#  Main Processing Function
# ──────────────────────────────────────────────


def process_video(video_path: str) -> VideoProcessingResult:
    """
    Process a class video file: detect faces, match against the
    biometric database, mark attendance for known students, and
    save cropped images of unknown faces.

    This function is designed to be called inside a
    ``FastAPI BackgroundTask`` so it does **not** block the
    main request/response cycle.

    Args:
        video_path: Absolute path to the uploaded video file.

    Returns:
        A ``VideoProcessingResult`` summarising the job.
    """
    video_file = Path(video_path)
    result = VideoProcessingResult(video_filename=video_file.name)

    # ── Validate video file exists ───────────────────────────────
    if not video_file.exists():
        error_message = f"Video file not found: {video_path}"
        logger.error(error_message)
        result.errors.append(error_message)
        result.completed_at = datetime.now(tz=timezone.utc)
        return result

    # ── Load known encodings ─────────────────────────────────────
    (
        known_face_encodings,
        known_student_ids,
        known_student_names,
        known_divisions,
    ) = _load_known_encodings()

    if not known_face_encodings:
        logger.warning(
            "No student encodings loaded — every face will be unknown."
        )

    # ── Open the video ───────────────────────────────────────────
    video_capture = cv2.VideoCapture(str(video_file))

    if not video_capture.isOpened():
        error_message = (
            f"Could not open video file '{video_file.name}'. "
            "The file may be corrupted or in an unsupported codec."
        )
        logger.error(error_message)
        result.errors.append(error_message)
        result.completed_at = datetime.now(tz=timezone.utc)
        _cleanup_temp_video(video_file)
        return result

    video_fps = video_capture.get(cv2.CAP_PROP_FPS)
    total_frame_count = int(video_capture.get(cv2.CAP_PROP_FRAME_COUNT))

    # Guard against invalid FPS metadata
    if video_fps <= 0:
        logger.warning(
            "Video reported FPS=%.2f — defaulting to 30.", video_fps
        )
        video_fps = 30.0

    # Calculate how many frames to skip so we only process
    # FRAMES_PER_SECOND_TO_PROCESS frames per second of video.
    frame_skip = max(
        1,
        int(video_fps / settings.frames_per_second_to_process),
    )

    logger.info(
        "Video opened: %.1f FPS, %d total frames, processing every %d-th frame.",
        video_fps,
        total_frame_count,
        frame_skip,
    )

    # ── Prepare output directory ─────────────────────────────────
    unknown_faces_output_dir = settings.unknown_faces_dir
    unknown_faces_output_dir.mkdir(parents=True, exist_ok=True)

    # Track which students have already been marked present
    # so we don't call mark_student_present() hundreds of times
    already_marked_student_ids: set = set()
    global_unknown_face_counter: int = 0

    # ── Frame-by-frame processing loop ───────────────────────────
    frame_number: int = 0

    while True:
        grabbed, frame_bgr = video_capture.read()

        if not grabbed:
            # End of video (or read error)
            break

        result.total_frames_read += 1

        # Skip frames we don't need to analyse
        if frame_number % frame_skip != 0:
            frame_number += 1
            continue

        frame_number += 1
        result.frames_processed += 1

        # Convert BGR → RGB (face_recognition requires RGB)
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

        # ── Detect faces & extract encodings ─────────────────────
        try:
            face_locations = face_recognition.face_locations(frame_rgb)
            face_encodings = face_recognition.face_encodings(
                frame_rgb, face_locations
            )
        except Exception as detection_error:
            logger.warning(
                "Face detection failed on frame %d: %s",
                frame_number,
                detection_error,
            )
            result.errors.append(
                f"Frame {frame_number}: detection error — {detection_error}"
            )
            continue

        if not face_locations:
            # No faces in this frame — move on
            continue

        result.faces_detected += len(face_encodings)

        # ── Match each detected face ─────────────────────────────
        for face_index, (face_encoding, face_location) in enumerate(
            zip(face_encodings, face_locations)
        ):
            matched = False

            if known_face_encodings:
                # Compute Euclidean distances to every known encoding
                face_distances = face_recognition.face_distance(
                    known_face_encodings, face_encoding
                )

                best_match_index = int(np.argmin(face_distances))
                best_distance = face_distances[best_match_index]

                if best_distance <= settings.face_match_threshold:
                    matched = True
                    matched_student_id = known_student_ids[best_match_index]
                    matched_student_name = known_student_names[best_match_index]
                    matched_division = known_divisions[best_match_index]

                    if matched_student_id not in already_marked_student_ids:
                        try:
                            mark_student_present(
                                student_id=matched_student_id,
                                student_name=matched_student_name,
                                division=matched_division,
                            )
                            already_marked_student_ids.add(matched_student_id)
                            result.students_matched += 1
                            logger.info(
                                "Marked present: %s (%s) — distance %.3f",
                                matched_student_name,
                                matched_student_id,
                                best_distance,
                            )
                        except Exception as csv_error:
                            logger.error(
                                "Failed to mark attendance for %s: %s",
                                matched_student_id,
                                csv_error,
                            )
                            result.errors.append(
                                f"CSV write error for {matched_student_id}: "
                                f"{csv_error}"
                            )

            if not matched:
                # Unknown face → crop and save
                saved_filename = _save_unknown_face(
                    frame_rgb=frame_rgb,
                    face_location=face_location,
                    output_directory=unknown_faces_output_dir,
                    face_index=global_unknown_face_counter,
                )
                if saved_filename:
                    global_unknown_face_counter += 1
                    result.unknown_faces_saved += 1
                    logger.info("Saved unknown face: %s", saved_filename)

    # ── Release resources ────────────────────────────────────────
    video_capture.release()
    result.completed_at = datetime.now(tz=timezone.utc)

    logger.info(
        "Video processing complete: %d frames read, %d processed, "
        "%d faces detected, %d students matched, %d unknowns saved.",
        result.total_frames_read,
        result.frames_processed,
        result.faces_detected,
        result.students_matched,
        result.unknown_faces_saved,
    )

    # ── Clean up the temporary video file ────────────────────────
    _cleanup_temp_video(video_file)

    return result


def _cleanup_temp_video(video_file: Path) -> None:
    """
    Delete the temporary video file after processing.
    Errors are logged but not raised.
    """
    try:
        if video_file.exists():
            video_file.unlink()
            logger.info("Deleted temporary video: %s", video_file.name)
    except OSError as delete_error:
        logger.warning(
            "Could not delete temporary video %s: %s",
            video_file.name,
            delete_error,
        )
