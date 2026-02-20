"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";

// ── Hardcoded credentials (college authority only) ──────────
const VALID_USERNAME = "i2it";
const VALID_PASSWORD = "student";

const SESSION_KEY = "lookin_auth";

interface AuthContextValue {
  /** Whether the user is authenticated. */
  isAuthenticated: boolean;
  /** Whether the initial session check is still running. */
  isLoading: boolean;
  /** Attempt to log in. Returns an error message on failure, or null on success. */
  login: (username: string, password: string) => string | null;
  /** Log out and clear session. */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provides authentication state to the entire app.
 * Credentials are validated client-side against the hardcoded pair.
 * Session is persisted in `sessionStorage` (cleared when the browser tab closes).
 */
export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /* ── Restore session on mount ──────────────────── */
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored === "true") {
        setIsAuthenticated(true);
      }
    } catch {
      // sessionStorage unavailable (SSR or privacy mode) — stay logged out
    }
    setIsLoading(false);
  }, []);

  /* ── Login handler ─────────────────────────────── */
  const login = useCallback(
    (username: string, password: string): string | null => {
      const trimmedUser = username.trim().toLowerCase();
      const trimmedPass = password.trim();

      if (
        trimmedUser === VALID_USERNAME &&
        trimmedPass === VALID_PASSWORD
      ) {
        setIsAuthenticated(true);
        try {
          sessionStorage.setItem(SESSION_KEY, "true");
        } catch {
          // ignore storage errors
        }
        return null; // success
      }

      return "Invalid username or password.";
    },
    []
  );

  /* ── Logout handler ────────────────────────────── */
  const logout = useCallback(() => {
    setIsAuthenticated(false);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated, isLoading, login, logout }),
    [isAuthenticated, isLoading, login, logout]
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
