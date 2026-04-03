"""
Quick end-to-end pipeline test for video upload and job status polling.

Usage:
    python scripts/pipeline_test.py --video path/to/video.mp4
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict

import requests


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Test the attendance video pipeline.")
    parser.add_argument("--video", required=True, help="Path to the video file.")
    parser.add_argument(
        "--base-url",
        default="http://localhost:8000",
        help="Backend base URL (default: http://localhost:8000).",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=2.0,
        help="Seconds between job status polls (default: 2.0).",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=300.0,
        help="Max seconds to wait for completion (default: 300).",
    )
    return parser.parse_args()


def _print_json(payload: Dict[str, Any]) -> None:
    print(json.dumps(payload, indent=2))


def main() -> int:
    args = _parse_args()
    video_path = Path(args.video).expanduser().resolve()

    if not video_path.exists():
        _print_json({"success": False, "error": "File not found", "detail": str(video_path)})
        return 1

    upload_url = f"{args.base_url.rstrip('/')}/api/attendance/upload-video"
    status_url = f"{args.base_url.rstrip('/')}/api/attendance/job-status"

    try:
        with video_path.open("rb") as video_file:
            response = requests.post(upload_url, files={"video": video_file}, timeout=60)
    except requests.RequestException as exc:
        _print_json({"success": False, "error": "Upload failed", "detail": str(exc)})
        return 1

    if response.status_code >= 400:
        try:
            payload = response.json()
        except ValueError:
            payload = {"success": False, "error": "Upload failed", "detail": response.text}
        _print_json(payload)
        return 1

    payload = response.json()
    job_id = payload.get("job_id")
    if not job_id:
        _print_json({"success": False, "error": "Missing job_id", "detail": payload})
        return 1

    _print_json({"success": True, "message": "Upload accepted", "job_id": job_id})

    start_time = time.time()
    while True:
        if time.time() - start_time > args.timeout:
            _print_json({"success": False, "error": "Timeout", "detail": "Job did not finish in time."})
            return 1

        try:
            status_response = requests.get(f"{status_url}/{job_id}", timeout=30)
        except requests.RequestException as exc:
            _print_json({"success": False, "error": "Status check failed", "detail": str(exc)})
            return 1

        if status_response.status_code >= 400:
            _print_json({"success": False, "error": "Status error", "detail": status_response.text})
            return 1

        status_payload = status_response.json()
        status = status_payload.get("status")

        if status in {"completed", "failed"}:
            _print_json(status_payload)
            return 0 if status == "completed" else 1

        print(f"Job {job_id} status: {status}. Waiting...")
        time.sleep(args.poll_interval)


if __name__ == "__main__":
    raise SystemExit(main())
