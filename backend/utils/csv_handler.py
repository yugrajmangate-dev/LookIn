"""
CSV Data Manager
================
Provides utility functions to read and write attendance records.
All I/O is routed through ``utils.storage`` which transparently
uses Supabase Storage in production and the local filesystem in dev.

Functions:
    - initialize_csv()         → No-op with Supabase; creates local CSV in dev.
    - mark_student_present()   → Appends a "present" record for a student.
    - fetch_daily_roster()     → Returns all attendance records for a date.
    - manual_override_attendance() → Creates or updates a record for a date.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

import pandas as pd

from config import settings
from models.schemas import AttendanceRecord
from utils.storage import load_attendance_df, save_attendance_df

ATTENDANCE_COLUMNS: List[str] = [
    "student_id",
    "student_name",
    "division",
    "date",
    "time",
    "status",
]


def initialize_csv() -> None:
    """
    Ensure the attendance data store is ready.
    With Supabase this is a no-op (the storage layer handles missing files).
    In local-dev mode it creates the CSV file and directory if absent.
    """
    if settings.supabase_url:
        return  # Supabase handles initialisation implicitly

    csv_path = settings.attendance_csv_path
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    if not csv_path.exists() or csv_path.stat().st_size == 0:
        pd.DataFrame(columns=ATTENDANCE_COLUMNS).to_csv(csv_path, index=False)


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
    """
    now = datetime.now()
    attendance_date = target_date or now.date()
    attendance_time = now.strftime("%H:%M:%S")

    df = load_attendance_df()

    if not df.empty:
        dup = (
            (df["student_id"] == student_id)
            & (df["date"] == str(attendance_date))
            & (df["status"] == "present")
        )
        if dup.any():
            row = df.loc[dup].iloc[0]
            return AttendanceRecord(
                student_id=row["student_id"],
                student_name=row["student_name"],
                division=row["division"] if pd.notna(row.get("division")) else None,
                date=date.fromisoformat(row["date"]),
                time=row["time"],
                status=row["status"],
            )

    new_record = AttendanceRecord(
        student_id=student_id,
        student_name=student_name,
        division=division,
        date=attendance_date,
        time=attendance_time,
        status="present",
    )

    new_row = pd.DataFrame([new_record.model_dump()])
    new_row["date"] = new_row["date"].astype(str)
    updated_df = pd.concat([df, new_row], ignore_index=True)
    save_attendance_df(updated_df)

    return new_record


def fetch_daily_roster(target_date: Optional[date] = None) -> List[AttendanceRecord]:
    """Retrieve every attendance record for the given date."""
    attendance_date = target_date or date.today()
    df = load_attendance_df()

    if df.empty:
        return []

    day_df = df[df["date"] == str(attendance_date)]

    records: List[AttendanceRecord] = []
    for _, row in day_df.iterrows():
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
    the **status** is updated in place. Otherwise a new row is appended.
    """
    now = datetime.now()
    attendance_date = target_date or now.date()
    attendance_time = now.strftime("%H:%M:%S")

    df = load_attendance_df()

    dup = (
        (df["student_id"] == student_id)
        & (df["date"] == str(attendance_date))
    ) if not df.empty else pd.Series([], dtype=bool)

    if not df.empty and dup.any():
        df.loc[dup, "status"] = status
        df.loc[dup, "time"] = attendance_time
        df.loc[dup, "student_name"] = student_name
        if division is not None:
            df.loc[dup, "division"] = division
        save_attendance_df(df)
    else:
        new_record_schema = AttendanceRecord(
            student_id=student_id,
            student_name=student_name,
            division=division,
            date=attendance_date,
            time=attendance_time,
            status=status,
        )
        new_row = pd.DataFrame([new_record_schema.model_dump()])
        new_row["date"] = new_row["date"].astype(str)
        updated_df = pd.concat([df, new_row], ignore_index=True)
        save_attendance_df(updated_df)

    return AttendanceRecord(
        student_id=student_id,
        student_name=student_name,
        division=division,
        date=attendance_date,
        time=attendance_time,
        status=status,
    )


