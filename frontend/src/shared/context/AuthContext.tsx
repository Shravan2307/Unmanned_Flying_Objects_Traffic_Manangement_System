import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type {
  AuthContextType,
  OperatorProfile,
  TokenPayload,
  OperatorRole,
} from "../types/auth";

const TOKEN_KEY = "utm_access_token";
const PROFILE_KEY = "utm_operator_profile";

/**
 * Client-side decode of JWT payload without requiring external binary dependencies.
 */
export function decodeJwtPayload(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(jsonPayload);

    // Validate expected claims
    const opId = Number(parsed.operator_id ?? parsed.id);
    const role = parsed.role as OperatorRole;

    if (!opId || !role) return null;

    return {
      id: opId,
      operator_id: opId,
      role,
      exp: parsed.exp ? Number(parsed.exp) : undefined,
    };
  } catch (err) {
    console.error("Failed to decode JWT token:", err);
    return null;
  }
}

/**
 * Check if token is expired (with 10-second margin)
 */
export function isTokenExpired(payload: TokenPayload): boolean {
  if (!payload.exp) return false;
  const currentTime = Math.floor(Date.now() / 1000);
  return payload.exp < currentTime + 10;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<TokenPayload | null>(null);
  const [operator, setOperator] = useState<OperatorProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch operator profile from backend
  const fetchProfile = useCallback(async (authToken: string) => {
    try {
      const res = await fetch("/api/operators/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data: OperatorProfile = await res.json();
        setOperator(data);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
      } else if (res.status === 401) {
        // Token rejected by server
        logout();
      }
    } catch (err) {
      console.error("Error fetching operator profile:", err);
    }
  }, []);

  // Restore session from localStorage on initial load
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedProfile = localStorage.getItem(PROFILE_KEY);

    if (savedToken) {
      const decoded = decodeJwtPayload(savedToken);
      if (decoded && !isTokenExpired(decoded)) {
        setToken(savedToken);
        setUser(decoded);
        if (savedProfile) {
          try {
            setOperator(JSON.parse(savedProfile));
          } catch {
            // Profile corrupted, refetch
            fetchProfile(savedToken);
          }
        } else {
          fetchProfile(savedToken);
        }
      } else {
        // Token invalid or expired
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(PROFILE_KEY);
      }
    }
    setIsLoading(false);
  }, [fetchProfile]);

  const login = useCallback(
    (newToken: string, operatorData?: OperatorProfile) => {
      const decoded = decodeJwtPayload(newToken);
      if (!decoded) {
        throw new Error("Cannot log in: Token payload is invalid");
      }
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setUser(decoded);

      if (operatorData) {
        setOperator(operatorData);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(operatorData));
      } else {
        fetchProfile(newToken);
      }
    },
    [fetchProfile]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
    setToken(null);
    setUser(null);
    setOperator(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (token) {
      await fetchProfile(token);
    }
  }, [token, fetchProfile]);

  const value = useMemo<AuthContextType>(
    () => ({
      token,
      user,
      operator,
      isAuthenticated: !!token && !!user,
      isLoading,
      login,
      logout,
      refreshProfile,
    }),
    [token, user, operator, isLoading, login, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return context;
};
