# Project Overview
This is a Student Attendance Management System using Computer Vision. 
It consists of a Next.js (React) frontend and a Python (FastAPI) backend.

# Global Coding Standards
- Write clean, modular, and well-documented code.
- Prefer explicit variable names over abbreviations (e.g., use `face_encoding` instead of `fe`).
- All error handling must return structured JSON responses.

# Tech Stack & Libraries
- Frontend: Next.js (App Router), React, Tailwind CSS, TypeScript.
- Backend: Python 3.10+, FastAPI, Uvicorn.
- Computer Vision: OpenCV (`cv2`), `face_recognition`, `numpy`.
- Data Handling: `pandas` for CSV generation.

# Security & Data Privacy
- NEVER hardcode secrets, API keys, or database credentials. Always use environment variables.
- Student biometric data (face encodings) and images must be handled securely and temporarily where possible.
