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
      const trimmedId = studentId.trim();
      
      if (!trimmedId) {
        return "Please enter your Student ID.";
      }

      try {
        const response = await fetch(apiUrl(`/api/enroll/verify/${encodeURIComponent(trimmedId)}`));
        const data = await response.json();

        if (!data.exists) {
          return "Student ID not found. Please check your ID or contact administration.";
        }

        const info: StudentInfo = {
          student_id: data.student_id,
          student_name: data.student_name || "Student",
          division: data.division || null,
        };

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

        return null; // success
      } catch (error) {
        console.error("Student login error:", error);
        return "Unable to verify student ID. Please try again later.";
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
