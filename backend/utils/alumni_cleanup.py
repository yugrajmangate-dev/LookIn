"""
Alumni Cleanup Utility
======================
Provides a function to bulk-remove graduated students from the
biometrics store. A student is considered an alumnus when their
``graduation_year`` is less than or equal to the supplied cutoff.

This keeps the biometrics JSON lean and prevents graduated students
from being matched during video processing.
"""

from __future__ import annotations

import json
import logging
from typing import Dict, List

from config import settings
from models.schemas import AlumniCleanupResult, StudentBiometricRecord

logger = logging.getLogger("alumni_cleanup")
logger.setLevel(logging.INFO)


def _load_biometrics_store() -> Dict[str, StudentBiometricRecord]:
    """Load the biometrics JSON file and return a dict keyed by student_id."""
    biometrics_path = settings.biometrics_path
    biometrics_path.parent.mkdir(parents=True, exist_ok=True)

    if not biometrics_path.exists() or biometrics_path.stat().st_size == 0:
        return {}

    raw_data: dict = json.loads(biometrics_path.read_text(encoding="utf-8"))

    store: Dict[str, StudentBiometricRecord] = {}
    for student_id, record_dict in raw_data.items():
        store[student_id] = StudentBiometricRecord(**record_dict)

    return store


def _save_biometrics_store(store: Dict[str, StudentBiometricRecord]) -> None:
    """Persist the biometrics store to JSON."""
    biometrics_path = settings.biometrics_path

    serialisable: dict = {}
    for student_id, record in store.items():
        serialisable[student_id] = record.model_dump(mode="json")

    biometrics_path.write_text(
        json.dumps(serialisable, indent=2, default=str),
        encoding="utf-8",
    )


def remove_alumni(graduation_year_cutoff: int) -> AlumniCleanupResult:
    """
    Remove every student whose ``graduation_year`` is less than or
    equal to *graduation_year_cutoff*.

    Students with a **null** ``graduation_year`` are **retained**
    (they are assumed to still be active).

    Args:
        graduation_year_cutoff: The inclusive upper-bound year.
            E.g. passing 2025 removes students who graduated
            in 2025 or any prior year.

    Returns:
        An ``AlumniCleanupResult`` summarising how many students
        were removed and their IDs.
    """
    biometrics_store = _load_biometrics_store()

    if not biometrics_store:
        return AlumniCleanupResult(
            success=True,
            message="Biometric store is empty — nothing to clean up.",
            removed_count=0,
            removed_student_ids=[],
        )

    removed_student_ids: List[str] = []

    for student_id, record in list(biometrics_store.items()):
        if (
            record.graduation_year is not None
            and record.graduation_year <= graduation_year_cutoff
        ):
            removed_student_ids.append(student_id)
            del biometrics_store[student_id]
            logger.info(
                "Removed alumnus %s (%s) — graduated %d",
                student_id,
                record.student_name,
                record.graduation_year,
            )

    if removed_student_ids:
        _save_biometrics_store(biometrics_store)

    return AlumniCleanupResult(
        success=True,
        message=(
            f"Removed {len(removed_student_ids)} alumnus/alumni with "
            f"graduation_year ≤ {graduation_year_cutoff}."
            if removed_student_ids
            else f"No students found with graduation_year ≤ {graduation_year_cutoff}."
        ),
        removed_count=len(removed_student_ids),
        removed_student_ids=removed_student_ids,
    )
