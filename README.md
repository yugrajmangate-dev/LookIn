# LookIn — Student Attendance Management System
Live-Website - (https://lookinportal.vercel.app/)

> Computer-vision-powered student attendance tracking using face recognition.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.129-009688?logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-4.x-5C3EE8?logo=opencv)

## Features...

- **Video-Based Attendance** — Upload a classroom video and detect enrolled student faces automatically.
- **Student Enrollment** — Register students with multiple face images for robust matching.
- **Daily Roster** — View the attendance log for any date.
- **Unknown Faces Review** — Browse unidentified face crops from processed videos.
- **Manual Override** — Mark students present/absent when CV misses a detection.
- **Alumni Cleanup** — Remove graduated students' biometric data.
- **Secure Login** — Only authorized college personnel can access the dashboard.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS, TypeScript |
| Backend | Python 3.10+, FastAPI, Uvicorn |
| Computer Vision | OpenCV, face_recognition, dlib, NumPy |
| Data | CSV (attendance), JSON (biometrics), filesystem (images/videos) |

## Project Structure

```
LookIn/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py             # Settings (env-based)
│   ├── models/schemas.py     # Pydantic models
│   ├── routes/
│   │   ├── enroll.py         # POST /api/enroll/
│   │   ├── attendance.py     # Video upload, roster, unknown faces
│   │   └── admin.py          # Alumni cleanup
│   └── utils/
│       ├── vision_engine.py  # Face detection & matching
│       ├── csv_handler.py    # Attendance CSV operations
│       └── alumni_cleanup.py # Graduated student removal
├── frontend/
│   ├── app/                  # Next.js App Router pages
│   ├── components/           # Reusable UI components
│   └── lib/api.ts            # API helpers & TypeScript interfaces
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- CMake (for dlib on some systems)

### Backend Setup

```bash
cd backend
python -m venv venv
# Windows: .\venv\Scripts\Activate.ps1
# Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:
```env
APP_ENV=development
DATA_DIR=data
BIOMETRICS_FILE=students_biometrics.json
ATTENDANCE_CSV=attendance_logs.csv
MAX_UPLOAD_SIZE_MB=50
UNKNOWN_FACES_DIRNAME=unknown_faces
TEMP_VIDEO_DIRNAME=temp_videos
FACE_MATCH_THRESHOLD=0.5
FRAMES_PER_SECOND_TO_PROCESS=2
CURRENT_ACADEMIC_YEAR=2026
```

Start the backend:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the frontend:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Login Credentials

| Field | Value |
|-------|-------|
| Username | `i2it` |
| Password | `*******` |

---

## Deployment

### Frontend → Vercel

1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo.
3. Set **Root Directory** to `frontend`.
4. Add **Environment Variable** in Vercel dashboard:
   - `NEXT_PUBLIC_API_URL` → your Render backend URL (e.g. `https://lookin-api.onrender.com`)
5. Click **Deploy**. Every `git push` to `main` will auto-redeploy.

### Backend → Render.com

1. Go to [render.com](https://render.com) → **New Web Service** → connect your GitHub repo.
2. Render will detect `render.yaml` automatically and configure the service.
3. After the first deploy, copy the service URL (e.g. `https://lookin-api.onrender.com`).
4. Paste that URL into Vercel's `NEXT_PUBLIC_API_URL` environment variable.
5. Also update `CORS_ORIGINS` in Render's environment settings to include your Vercel URL.

> **Important — Data Persistence on Free Tier:**  
> Render's free tier uses an **ephemeral filesystem**. All data (attendance CSV,
> face encodings, unknown face images) is **wiped on every redeploy**.  
> To avoid data loss in production:
> - Upgrade to a Render paid plan and attach a **Persistent Disk** mounted at `/app/data`.
> - Or migrate data storage to an external service (S3, Supabase, PostgreSQL).

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/api/enroll/` | Enroll a student with face images |
| GET | `/api/enroll/list` | List all enrolled students |
| DELETE | `/api/enroll/{student_id}` | Remove a student's biometric data |
| POST | `/api/attendance/upload-video` | Upload classroom video for processing |
| GET | `/api/attendance/job-status/{id}` | Poll background processing job status |
| GET | `/api/attendance/unknown-faces` | List unidentified face crops |
| GET | `/api/attendance/daily-roster?date=YYYY-MM-DD` | Get attendance for a date |
| GET | `/api/attendance/export-csv?date=YYYY-MM-DD` | Download attendance CSV |
| POST | `/api/attendance/manual-override` | Manually mark attendance |
| POST | `/api/admin/alumni-cleanup` | Remove graduated student data |

## License

This project is for educational purposes at I2IT.
