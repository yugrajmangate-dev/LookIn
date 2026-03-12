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

import logging
from typing import Dict, List

from models.schemas import AlumniCleanupResult, StudentBiometricRecord
from utils.storage import load_biometrics_raw, save_biometrics_raw

logger = logging.getLogger("alumni_cleanup")
logger.setLevel(logging.INFO)


def _load_biometrics_store() -> Dict[str, StudentBiometricRecord]:
    """Load the biometrics store via the storage layer (Supabase or local)."""
    raw_data = load_biometrics_raw()
    return {
        sid: StudentBiometricRecord(**rec)
        for sid, rec in raw_data.items()
    }


def _save_biometrics_store(store: Dict[str, StudentBiometricRecord]) -> None:
    """Persist the biometrics store via the storage layer (Supabase or local)."""
    save_biometrics_raw(
        {sid: record.model_dump(mode="json") for sid, record in store.items()}
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
