"""
Admin Router
============
Administrative endpoints for system maintenance tasks
such as alumni cleanup.

Endpoints:
    POST /alumni-cleanup   — Remove graduated students from the biometric store.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from models.schemas import (
    AlumniCleanupRequest,
    AlumniCleanupResult,
    ErrorResponse,
)
from utils.alumni_cleanup import remove_alumni

router = APIRouter(prefix="/admin", tags=["Admin"])


# ──────────────────────────────────────────────
#  POST /alumni-cleanup
# ──────────────────────────────────────────────


@router.post(
    "/alumni-cleanup",
    response_model=AlumniCleanupResult,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Remove graduated students from the biometric store",
    description=(
        "Bulk-deletes all students whose graduation_year is less than "
        "or equal to the specified cutoff. Students without a "
        "graduation_year are retained. This endpoint is irreversible — "
        "removed biometric data cannot be recovered."
    ),
)
async def alumni_cleanup(
    payload: AlumniCleanupRequest,
) -> AlumniCleanupResult:
    """
    **Admin-only** endpoint for graduating-out old students.

    Workflow:
    1. Validate the cutoff year.
    2. Delegate to ``remove_alumni()`` which filters and persists.
    3. Return a summary of removed students.
    """
    try:
        result = remove_alumni(
            graduation_year_cutoff=payload.graduation_year_cutoff,
        )
    except Exception as cleanup_error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                error="Alumni cleanup failed",
                detail=f"An unexpected error occurred: {cleanup_error}",
            ).model_dump(),
        )

    return result
