"""
Application configuration loaded from environment variables.
Uses pydantic-settings to enforce typing and defaults.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Global application settings sourced from .env file."""

    app_env: str = "development"
    data_dir: str = "data"
    biometrics_file: str = "students_biometrics.json"
    attendance_csv: str = "attendance_logs.csv"
    max_upload_size_mb: int = 100
    unknown_faces_dirname: str = "unknown_faces"
    temp_video_dirname: str = "temp_videos"
    jobs_file: str = "processing_jobs.json"
    face_match_threshold: float = 0.5
    frames_per_second_to_process: int = 2
    current_academic_year: int = 2026
    cors_origins: str = "http://localhost:3000,https://lookinportal.vercel.app"

    @property
    def data_path(self) -> Path:
        """Return the absolute path to the data directory."""
        return Path(__file__).parent / self.data_dir

    @property
    def biometrics_path(self) -> Path:
        """Return the absolute path to the biometrics JSON file."""
        return self.data_path / self.biometrics_file

    @property
    def attendance_csv_path(self) -> Path:
        """Return the absolute path to the attendance CSV file."""
        return self.data_path / self.attendance_csv

    @property
    def unknown_faces_dir(self) -> Path:
        """Return the absolute path to the unknown faces image directory."""
        return self.data_path / self.unknown_faces_dirname

    @property
    def temp_video_dir(self) -> Path:
        """Return the absolute path to temporary video upload storage."""
        return self.data_path / self.temp_video_dirname

    @property
    def jobs_path(self) -> Path:
        """Return the absolute path to the processing jobs JSON file."""
        return self.data_path / self.jobs_file

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), ".env")
        env_file_encoding = "utf-8"


settings = Settings()
