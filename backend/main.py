"""
LookIn — Student Attendance Management System (Backend)
=======================================================
FastAPI application entrypoint.

Run with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from routes.admin import router as admin_router
from routes.attendance import router as attendance_router
from routes.enroll import router as enroll_router
from utils.csv_handler import initialize_csv


@asynccontextmanager
async def lifespan(application: FastAPI):
    """
    Startup / shutdown lifecycle hook.
    Ensures all required data files and directories exist
    before the first request.
    """
    # ── Startup ──
    settings.data_path.mkdir(parents=True, exist_ok=True)
    settings.unknown_faces_dir.mkdir(parents=True, exist_ok=True)
    settings.temp_video_dir.mkdir(parents=True, exist_ok=True)
    initialize_csv()
    yield
    # ── Shutdown ── (nothing to clean up for now)


app = FastAPI(
    title="LookIn — Attendance System API",
    description="Computer-vision-powered student attendance management.",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS (allow the Next.js frontend during development) ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static Files: serve unknown face crops to the frontend ──
# Ensure the directory exists before mounting (StaticFiles checks at init time,
# which is before the lifespan creates it on a fresh installation).
settings.unknown_faces_dir.mkdir(parents=True, exist_ok=True)

app.mount(
    "/static/unknown_faces",
    StaticFiles(directory=str(settings.unknown_faces_dir)),
    name="unknown_faces",
)

# ── Register Routers ──
app.include_router(enroll_router, prefix="/api")
app.include_router(attendance_router, prefix="/api")
app.include_router(admin_router, prefix="/api")


@app.get("/", tags=["Health"])
async def health_check():
    """Simple health-check endpoint."""
    return {"success": True, "message": "LookIn API is running."}
