/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { getCurrentUser } from "../services/admin-api";
import {
  clearAuthState,
  persistAuthState,
  readAuthState,
} from "../services/auth-storage";
import type { UserRole } from "../types/auth";

type AuthContextValue = {
  token: string;
  refreshToken: string;
  idToken: string;
  role: UserRole | null;
  isAuthenticated: boolean;
  isHydratingRole: boolean;
  login: (
    token: string,
    role: UserRole,
    extras?: { refreshToken?: string; idToken?: string },
  ) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const initial = readAuthState();
  const [token, setToken] = useState(initial.token);
  const [refreshToken, setRefreshToken] = useState(initial.refreshToken);
  const [idToken, setIdToken] = useState(initial.idToken);
  const [role, setRole] = useState<UserRole | null>(initial.role);

  useEffect(() => {
    if (!token || role) {
      return;
    }

    let active = true;

    const resolveCurrentRole = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!active) {
          return;
        }

        setRole(currentUser.role);
        persistAuthState({
          token,
          refreshToken,
          idToken,
          role: currentUser.role,
        });
      } catch {
        if (!active) {
          return;
        }

        setToken("");
        setRefreshToken("");
        setIdToken("");
        setRole(null);
        clearAuthState();
      }
    };

    void resolveCurrentRole();

    return () => {
      active = false;
    };
  }, [idToken, refreshToken, role, token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      refreshToken,
      idToken,
      role,
      isAuthenticated: Boolean(token),
      isHydratingRole: Boolean(token) && !role,
      login: (nextToken, nextRole, extras) => {
        setToken(nextToken);
        setRefreshToken(extras?.refreshToken ?? "");
        setIdToken(extras?.idToken ?? "");
        setRole(nextRole);
        persistAuthState({
          token: nextToken,
          refreshToken: extras?.refreshToken ?? "",
          idToken: extras?.idToken ?? "",
          role: nextRole,
        });
      },
      logout: () => {
        setToken("");
        setRefreshToken("");
        setIdToken("");
        setRole(null);
        clearAuthState();
      },
    }),
    [idToken, refreshToken, role, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
