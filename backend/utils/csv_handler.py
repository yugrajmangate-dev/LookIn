"""
CSV Data Manager
================
Provides utility functions to initialise, read, and append records
to the attendance_logs.csv using **Pandas** (per project standards).

Functions:
    - initialize_csv()         → Ensures the CSV and data directory exist.
    - mark_student_present()   → Appends a "present" record for a student.
    - fetch_daily_roster()     → Returns all attendance records for a date.
"""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

import pandas as pd

from config import settings
from models.schemas import AttendanceRecord

# Column schema for the attendance CSV
ATTENDANCE_COLUMNS: List[str] = [
    "student_id",
    "student_name",
    "division",
    "date",
    "time",
    "status",
]


def _csv_path() -> Path:
    """Return the resolved path to the attendance CSV file."""
    return settings.attendance_csv_path


def initialize_csv() -> None:
    """
    Ensure the data directory and the attendance CSV file exist.
    If the CSV is missing or empty, create it with the correct header row.
    """
    csv_path = _csv_path()
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    if not csv_path.exists() or csv_path.stat().st_size == 0:
        empty_dataframe = pd.DataFrame(columns=ATTENDANCE_COLUMNS)
        empty_dataframe.to_csv(csv_path, index=False)


def mark_student_present(
    student_id: str,
    student_name: str,
    division: Optional[str] = None,
    target_date: Optional[date] = None,
) -> AttendanceRecord:
    """
    Append a *present* attendance record for the given student.

    If the student already has a "present" entry for the same date,
    the duplicate is **not** written and the existing record is returned.

    Args:
        student_id:   Unique student identifier.
        student_name: Full name of the student.
        division:     Optional class division / section.
        target_date:  Date to mark attendance for (defaults to today).

    Returns:
        The ``AttendanceRecord`` that was written (or already existed).
    """
    initialize_csv()
    csv_path = _csv_path()

    now = datetime.now()
    attendance_date = target_date or now.date()
    attendance_time = now.strftime("%H:%M:%S")

    # Read current data to check for duplicates
    existing_dataframe = pd.read_csv(csv_path, dtype=str)

    duplicate_mask = (
        (existing_dataframe["student_id"] == student_id)
        & (existing_dataframe["date"] == str(attendance_date))
        & (existing_dataframe["status"] == "present")
    )

    if duplicate_mask.any():
        # Return the first existing record instead of duplicating
        existing_row = existing_dataframe.loc[duplicate_mask].iloc[0]
        return AttendanceRecord(
            student_id=existing_row["student_id"],
            student_name=existing_row["student_name"],
            division=existing_row["division"] if pd.notna(existing_row.get("division")) else None,
            date=date.fromisoformat(existing_row["date"]),
            time=existing_row["time"],
            status=existing_row["status"],
        )

    # Build new record
    new_record = AttendanceRecord(
        student_id=student_id,
        student_name=student_name,
        division=division,
        date=attendance_date,
        time=attendance_time,
        status="present",
    )

    new_row_dataframe = pd.DataFrame([new_record.model_dump()])
    # Ensure date is serialised as a string
    new_row_dataframe["date"] = new_row_dataframe["date"].astype(str)
    new_row_dataframe.to_csv(csv_path, mode="a", header=False, index=False)

    return new_record


def fetch_daily_roster(target_date: Optional[date] = None) -> List[AttendanceRecord]:
    """
    Retrieve every attendance record for the given date.

    Args:
        target_date: The date to query (defaults to today).

    Returns:
        A list of ``AttendanceRecord`` objects for that day.
    """
    initialize_csv()
    csv_path = _csv_path()

    attendance_date = target_date or date.today()

    full_dataframe = pd.read_csv(csv_path, dtype=str)

    if full_dataframe.empty:
        return []

    day_mask = full_dataframe["date"] == str(attendance_date)
    day_dataframe = full_dataframe.loc[day_mask]

    records: List[AttendanceRecord] = []
    for _, row in day_dataframe.iterrows():
        records.append(
            AttendanceRecord(
                student_id=row["student_id"],
                student_name=row["student_name"],
                division=row["division"] if pd.notna(row.get("division")) else None,
                date=date.fromisoformat(row["date"]),
                time=row["time"],
                status=row["status"],
            )
        )

    return records


def manual_override_attendance(
    student_id: str,
    student_name: str,
    division: Optional[str] = None,
    target_date: Optional[date] = None,
    status: str = "present",
) -> AttendanceRecord:
    """
    Manually mark a student present or absent for a given date.

    If a record already exists for that student on the same date,
    the **status** is updated in place (no duplicate row created).
    Otherwise a brand-new row is appended.

    Args:
        student_id:   Unique student identifier.
        student_name: Full name of the student.
        division:     Optional class division / section.
        target_date:  Date to mark attendance for (defaults to today).
        status:       Either ``"present"`` or ``"absent"``.

    Returns:
        The ``AttendanceRecord`` that was written or updated.
    """
    initialize_csv()
    csv_path = _csv_path()

    now = datetime.now()
    attendance_date = target_date or now.date()
    attendance_time = now.strftime("%H:%M:%S")

    existing_dataframe = pd.read_csv(csv_path, dtype=str)

    # Check if a record already exists for this student on this date
    duplicate_mask = (
        (existing_dataframe["student_id"] == student_id)
        & (existing_dataframe["date"] == str(attendance_date))
    )

    if duplicate_mask.any():
        # Update the existing row's status and time in place
        existing_dataframe.loc[duplicate_mask, "status"] = status
        existing_dataframe.loc[duplicate_mask, "time"] = attendance_time
        existing_dataframe.loc[duplicate_mask, "student_name"] = student_name
        if division is not None:
            existing_dataframe.loc[duplicate_mask, "division"] = division
        existing_dataframe.to_csv(csv_path, index=False)

        return AttendanceRecord(
            student_id=student_id,
            student_name=student_name,
            division=division,
            date=attendance_date,
            time=attendance_time,
            status=status,
        )

    # No existing record — append a new one
    new_record = AttendanceRecord(
        student_id=student_id,
        student_name=student_name,
        division=division,
        date=attendance_date,
        time=attendance_time,
        status=status,
    )

    new_row_dataframe = pd.DataFrame([new_record.model_dump()])
    new_row_dataframe["date"] = new_row_dataframe["date"].astype(str)
    new_row_dataframe.to_csv(csv_path, mode="a", header=False, index=False)

    return new_record
