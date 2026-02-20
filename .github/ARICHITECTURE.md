# System Architecture: Computer Vision Attendance System

## 1. System Overview
This is a full-stack Student Attendance Management System. It uses a Next.js frontend for an admin dashboard and a FastAPI backend to handle heavy computer vision tasks (OpenCV, dlib, face_recognition) asynchronously.

## 2. Tech Stack
- **Frontend:** Next.js (App Router), React, Tailwind CSS.
- **Backend:** Python 3.10+, FastAPI, Uvicorn, Pydantic.
- **AI/CV Engine:** OpenCV (`cv2`), `face_recognition`, `numpy`.
- **Database/Storage:** Local JSON (`students_biometrics.json`) for face encodings, CSV (`attendance_logs.csv`) for daily logs, and local file storage for cropped unknown faces.

## 3. Data Flow & Core Workflows

### A. Face Data Registration (Instant Onboarding)
1. Admin uploads an image (or captures via webcam) through the Next.js UI.
2. FastAPI receives the image, and `face_recognition` extracts multiple 128-d face encodings.
3. The encodings, along with the student's ID, Name, Class, and Graduation Year, are saved to `students_biometrics.json`.

### B. Batch Video Processing (Cross-Division)
1. Admin uploads a class video to the dashboard.
2. Next.js sends the video to a FastAPI endpoint which triggers a `BackgroundTask`.
3. OpenCV processes the video (skipping frames for efficiency) and detects faces globally against the entire JSON database.
4. **Matches:** Euclidean distance < 0.5. The student's ID is logged as "Present" in `attendance_logs.csv` with a timestamp.
5. **Unknowns:** Faces with distance > 0.5 are cropped using NumPy slicing (`frame[y:y+h, x:x+w]`) and saved to `/storage/unknown_faces/`.
6. The frontend polls the backend and displays the cropped unknown faces for manual review.

### C. Manual Override
1. Admin views the daily CSV roster on the frontend.
2. Clicking "Mark Present" sends a PUT request to the backend, appending a manual entry into `attendance_logs.csv`.

### D. Automated Alumni Deletion
1. A background cron-like script checks `graduation_year` in the JSON database.
2. If `current_year > graduation_year`, the student's encodings and historical logs are permanently deleted.