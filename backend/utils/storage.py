"""
Cloud Storage Abstraction Layer
================================
Provides a unified interface for reading and writing persistent data.

When SUPABASE_URL + SUPABASE_SERVICE_KEY are set (production on Render),
all data is stored in Supabase Storage so it survives container restarts.

When those env vars are absent (local development), all data falls back
to the local filesystem — zero config required for dev.

Supabase bucket layout:
    lookin-data/          (private bucket)
        biometrics.json   — student face encodings
        attendance.csv    — attendance log
    unknown-faces/        (public bucket)
        *.jpg             — cropped unknown-face images
"""

from __future__ import annotations

import io
import json
import logging
from pathlib import Path
from typing import Optional

import pandas as pd

logger = logging.getLogger("storage")

_LOOKIN_BUCKET = "lookin-data"
_BIOMETRICS_KEY = "biometrics.json"
_ATTENDANCE_KEY = "attendance.csv"
_FACES_BUCKET = "unknown-faces"

_CSV_COLUMNS = ["student_id", "student_name", "division", "date", "time", "status"]


# ──────────────────────────────────────────────
#  Lazy Supabase client (created once per process)
# ──────────────────────────────────────────────

_supabase_client = None
_client_initialised = False


def _get_supabase():
    """
    Return an authenticated Supabase client if env vars are configured.
    Returns None in local-dev mode (no Supabase vars set).
    """
    global _supabase_client, _client_initialised

    if _client_initialised:
        return _supabase_client

    _client_initialised = True

    from config import settings  # deferred to avoid circular import at module level

    url = settings.supabase_url.strip()
    key = settings.supabase_service_key.strip()

    if not url or not key:
        logger.info("Supabase not configured — using local filesystem storage.")
        _supabase_client = None
        return None

    try:
        from supabase import create_client

        _supabase_client = create_client(url, key)
        logger.info("Supabase storage client initialised.")
    except Exception as exc:
        logger.error("Failed to create Supabase client: %s", exc)
        _supabase_client = None

    return _supabase_client


# ──────────────────────────────────────────────
#  Biometrics JSON
# ──────────────────────────────────────────────


def load_biometrics_raw() -> dict:
    """
    Load the raw biometrics dict.
    Returns an empty dict if the file does not exist yet.
    """
    client = _get_supabase()

    if client:
        try:
            raw = client.storage.from_(_LOOKIN_BUCKET).download(_BIOMETRICS_KEY)
            return json.loads(raw.decode("utf-8"))
        except Exception as exc:
            logger.warning(
                "Supabase biometrics download failed: %s — returning empty store.", exc
            )
            return {}

    # ── Local filesystem fallback ─────────────────
    from config import settings

    path = settings.biometrics_path
    if not path.exists() or path.stat().st_size == 0:
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_biometrics_raw(data: dict) -> None:
    """Persist the raw biometrics dict."""
    encoded = json.dumps(data, indent=2, default=str).encode("utf-8")

    client = _get_supabase()

    if client:
        try:
            client.storage.from_(_LOOKIN_BUCKET).upload(
                _BIOMETRICS_KEY,
                encoded,
                {"content-type": "application/json", "upsert": "true"},
            )
            return
        except Exception as exc:
            logger.error(
                "Supabase biometrics upload failed: %s — writing to local disk.", exc
            )

    # ── Local filesystem fallback ─────────────────
    from config import settings

    path = settings.biometrics_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encoded)


# ──────────────────────────────────────────────
#  Attendance CSV
# ──────────────────────────────────────────────


def load_attendance_df() -> pd.DataFrame:
    """
    Load the full attendance CSV.
    Returns an empty DataFrame with correct columns if the file does not exist.
    """
    client = _get_supabase()

    if client:
        try:
            raw = client.storage.from_(_LOOKIN_BUCKET).download(_ATTENDANCE_KEY)
            return pd.read_csv(io.BytesIO(raw), dtype=str)
        except Exception as exc:
            logger.warning(
                "Supabase attendance download failed: %s — returning empty.", exc
            )
            return pd.DataFrame(columns=_CSV_COLUMNS)

    # ── Local filesystem fallback ─────────────────
    from config import settings

    path = settings.attendance_csv_path
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame(columns=_CSV_COLUMNS)
    return pd.read_csv(path, dtype=str)


def save_attendance_df(df: pd.DataFrame) -> None:
    """Persist the full attendance DataFrame."""
    csv_bytes = df.to_csv(index=False).encode("utf-8")

    client = _get_supabase()

    if client:
        try:
            client.storage.from_(_LOOKIN_BUCKET).upload(
                _ATTENDANCE_KEY,
                csv_bytes,
                {"content-type": "text/csv", "upsert": "true"},
            )
            return
        except Exception as exc:
            logger.error(
                "Supabase attendance upload failed: %s — writing to local disk.", exc
            )

    # ── Local filesystem fallback ─────────────────
    from config import settings

    path = settings.attendance_csv_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(csv_bytes)


# ──────────────────────────────────────────────
#  Unknown Face Images
# ──────────────────────────────────────────────


def save_unknown_face_image(filename: str, jpeg_bytes: bytes) -> str:
    """
    Save a cropped unknown-face JPEG.

    Returns the publicly accessible URL for the image so the frontend
    can display it — either a Supabase CDN URL or a local static path.
    """
    client = _get_supabase()

    if client:
        try:
            client.storage.from_(_FACES_BUCKET).upload(
                filename,
                jpeg_bytes,
                {"content-type": "image/jpeg", "upsert": "true"},
            )
            return client.storage.from_(_FACES_BUCKET).get_public_url(filename)
        except Exception as exc:
            logger.error(
                "Supabase face image upload failed: %s — saving to local disk.", exc
            )

    # ── Local filesystem fallback ─────────────────
    from config import settings

    out_path = settings.unknown_faces_dir / filename
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(jpeg_bytes)
    return f"/static/unknown_faces/{filename}"


def list_unknown_face_images() -> list:
    """
    List all unknown face images stored in Supabase or on local disk.

    Returns a list of ``{"filename": str, "image_url": str}`` dicts,
    sorted by filename (chronological order since filenames include timestamps).
    """
    client = _get_supabase()

    if client:
        try:
            files = client.storage.from_(_FACES_BUCKET).list()
            allowed = {".jpg", ".jpeg", ".png"}
            results = []
            for entry in files:
                name: str = entry.get("name", "")
                if Path(name).suffix.lower() in allowed:
                    url = client.storage.from_(_FACES_BUCKET).get_public_url(name)
                    results.append({"filename": name, "image_url": url})
            return sorted(results, key=lambda x: x["filename"])
        except Exception as exc:
            logger.warning(
                "Supabase face list failed: %s — falling back to local.", exc
            )

    # ── Local filesystem fallback ─────────────────
    from config import settings

    faces_dir = settings.unknown_faces_dir
    if not faces_dir.exists():
        return []

    allowed = {".jpg", ".jpeg", ".png", ".bmp"}
    results = []
    for f in sorted(faces_dir.iterdir()):
        if f.is_file() and f.suffix.lower() in allowed:
            results.append(
                {"filename": f.name, "image_url": f"/static/unknown_faces/{f.name}"}
            )
    return results
