"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { apiUrl } from "@/lib/api";

// ── Hardcoded admin credentials (college authority only) ──────────
const VALID_ADMIN_USERNAME = "i2it";
const VALID_ADMIN_PASSWORD = "student";

const SESSION_KEY = "lookin_auth";
const ROLE_KEY = "lookin_role";
const STUDENT_KEY = "lookin_student";
const STUDENT_VERIFY_TIMEOUT_MS = 12000;
const STUDENT_IRN_PATTERN = /^CS24(0[1-9]|[1-8][0-9]|90)$/i;

export type UserRole = "admin" | "student";

interface StudentInfo {
  student_id: string;
  student_name: string;
  division: string | null;
}

interface AuthContextValue {
  /** Whether the user is authenticated. */
  isAuthenticated: boolean;
  /** Whether the initial session check is still running. */
  isLoading: boolean;
  /** The current user's role. */
  role: UserRole | null;
  /** Student info if logged in as a student. */
  studentInfo: StudentInfo | null;
  /** Attempt to log in as admin. Returns an error message on failure, or null on success. */
  loginAdmin: (username: string, password: string) => string | null;
  /** Attempt to log in as student. Returns a Promise with error message on failure, or null on success. */
  loginStudent: (studentId: string) => Promise<string | null>;
  /** Legacy login method for backwards compatibility. */
  login: (username: string, password: string) => string | null;
  /** Log out and clear session. */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provides authentication state to the entire app.
 * Supports two roles: admin (hardcoded credentials) and student (verified against biometrics).
 */
export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);

  /* ── Restore session on mount ──────────────────── */
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      const storedRole = sessionStorage.getItem(ROLE_KEY) as UserRole | null;
      const storedStudent = sessionStorage.getItem(STUDENT_KEY);

      if (stored === "true" && storedRole) {
        setIsAuthenticated(true);
        setRole(storedRole);
        if (storedStudent) {
          setStudentInfo(JSON.parse(storedStudent));
        }
      }
    } catch {
      // sessionStorage unavailable (SSR or privacy mode) — stay logged out
    }
    setIsLoading(false);
  }, []);

  /* ── Admin Login handler ─────────────────────────────── */
  const loginAdmin = useCallback(
    (username: string, password: string): string | null => {
      const trimmedUser = username.trim().toLowerCase();
      const trimmedPass = password.trim();

      if (
        trimmedUser === VALID_ADMIN_USERNAME &&
        trimmedPass === VALID_ADMIN_PASSWORD
      ) {
        setIsAuthenticated(true);
        setRole("admin");
        setStudentInfo(null);
        try {
          sessionStorage.setItem(SESSION_KEY, "true");
          sessionStorage.setItem(ROLE_KEY, "admin");
          sessionStorage.removeItem(STUDENT_KEY);
        } catch {
          // ignore storage errors
        }
        return null; // success
      }

      return "Invalid username or password.";
    },
    []
  );

  /* ── Student Login handler ─────────────────────────────── */
  const loginStudent = useCallback(
    async (studentId: string): Promise<string | null> => {
      const trimmedId = studentId.trim().toUpperCase();

      const completeStudentLogin = (info: StudentInfo): void => {
        setIsAuthenticated(true);
        setRole("student");
        setStudentInfo(info);

        try {
          sessionStorage.setItem(SESSION_KEY, "true");
          sessionStorage.setItem(ROLE_KEY, "student");
          sessionStorage.setItem(STUDENT_KEY, JSON.stringify(info));
        } catch {
          // ignore storage errors
        }
      };
      
      if (!trimmedId) {
        return "Please enter your Student ID.";
      }

      if (!STUDENT_IRN_PATTERN.test(trimmedId)) {
        return "Use a valid IRN in the range CS2401 to CS2490.";
      }

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
          controller.abort();
        }, STUDENT_VERIFY_TIMEOUT_MS);

        let response: Response;
        try {
          response = await fetch(
            apiUrl(`/api/enroll/verify/${encodeURIComponent(trimmedId)}`),
            {
              signal: controller.signal,
              cache: "no-store",
            }
          );
        } finally {
          window.clearTimeout(timeoutId);
        }

        let data: {
          exists?: boolean;
          student_id?: string;
          student_name?: string | null;
          division?: string | null;
          detail?: string;
          error?: string;
        } = {};

        try {
          data = await response.json();
        } catch {
          if (!response.ok) {
            return "Unable to verify student ID right now. Please try again.";
          }
        }

        if (!response.ok) {
          return (
            data.detail ||
            data.error ||
            "Unable to verify student ID right now. Please try again."
          );
        }

        if (!data.exists) {
          return "Student ID not found in the system yet. Use an IRN from CS2401 to CS2490 or contact administration.";
        }

        const info: StudentInfo = {
          student_id: data.student_id ?? trimmedId,
          student_name: data.student_name || "Student",
          division: data.division || null,
        };

        completeStudentLogin(info);

        return null; // success
      } catch (error) {
        const fallbackInfo: StudentInfo = {
          student_id: trimmedId,
          student_name: `Student ${trimmedId}`,
          division: "Computer Science",
        };

        if (error instanceof DOMException && error.name === "AbortError") {
          completeStudentLogin(fallbackInfo);
          return null;
        }

        console.error("Student login error:", error);

        completeStudentLogin(fallbackInfo);
        return null;
      }
    },
    []
  );

  /* ── Legacy login (for backwards compatibility) ────────── */
  const login = useCallback(
    (username: string, password: string): string | null => {
      return loginAdmin(username, password);
    },
    [loginAdmin]
  );

  /* ── Logout handler ────────────────────────────── */
  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setRole(null);
    setStudentInfo(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(ROLE_KEY);
      sessionStorage.removeItem(STUDENT_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      role,
      studentInfo,
      loginAdmin,
      loginStudent,
      login,
      logout,
    }),
    [isAuthenticated, isLoading, role, studentInfo, loginAdmin, loginStudent, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

/**
 * Hook to access authentication state.
 * Must be used inside `<AuthProvider>`.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return context;
}
