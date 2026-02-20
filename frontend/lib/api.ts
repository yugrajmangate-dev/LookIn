/**
 * Centralized API fetch configuration.
 *
 * All frontend data-fetching calls go through these helpers
 * so the backend base URL is configured in a single place.
 */

const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Construct a full API URL from a relative path.
 * @example apiUrl("/api/attendance/daily-roster") → "http://localhost:8000/api/attendance/daily-roster"
 */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/**
 * Construct a full static-file URL for backend-hosted assets.
 * @example staticUrl("/static/unknown_faces/unknown_20250610_143025_0.jpg")
 */
export function staticUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

// ──────────────────────────────────────────────
//  Shared TypeScript interfaces matching
//  backend Pydantic schemas
// ──────────────────────────────────────────────

export interface AttendanceRecord {
  student_id: string;
  student_name: string;
  division: string | null;
  date: string;
  time: string;
  status: string;
}

export interface DailyRosterResponse {
  success: boolean;
  date: string;
  total_records: number;
  records: AttendanceRecord[];
}

export interface VideoUploadResponse {
  success: boolean;
  message: string;
  video_filename: string;
}

export interface UnknownFaceEntry {
  filename: string;
  image_url: string;
  detected_at: string | null;
}

export interface UnknownFacesListResponse {
  success: boolean;
  total_count: number;
  faces: UnknownFaceEntry[];
}

export interface EnrollmentResponse {
  success: boolean;
  message: string;
  student_id: string;
  encodings_stored: number;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
  detail: string | null;
}

// ──────────────────────────────────────────────
//  Manual Override (Phase 4)
// ──────────────────────────────────────────────

export interface ManualOverrideRequest {
  student_id: string;
  student_name: string;
  division?: string | null;
  date: string;
  status: "present" | "absent";
}

export interface ManualOverrideResponse {
  success: boolean;
  message: string;
  record: AttendanceRecord;
}

// ──────────────────────────────────────────────
//  Alumni Cleanup (Phase 4)
// ──────────────────────────────────────────────

export interface AlumniCleanupRequest {
  graduation_year_cutoff: number;
}

export interface AlumniCleanupResult {
  success: boolean;
  message: string;
  removed_count: number;
  removed_student_ids: string[];
}
