import type { AuthState, UserRole } from "../types/auth";

const TOKEN_KEY = "chat_platform_access_token";
const REFRESH_TOKEN_KEY = "chat_platform_refresh_token";
const ID_TOKEN_KEY = "chat_platform_id_token";
const ROLE_KEY = "chat_platform_role";

export function readAuthState(): AuthState {
  if (typeof window === "undefined") {
    return { token: "", refreshToken: "", idToken: "", role: null };
  }

  const token = window.localStorage.getItem(TOKEN_KEY) ?? "";
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY) ?? "";
  const idToken = window.localStorage.getItem(ID_TOKEN_KEY) ?? "";
  const rawRole = window.localStorage.getItem(ROLE_KEY);
  const role: UserRole | null =
    rawRole === "agent" || rawRole === "supervisor" ? rawRole : null;

  return { token, refreshToken, idToken, role };
}

export function persistAuthState(state: AuthState): void {
  if (typeof window === "undefined") {
    return;
  }

  if (state.token) {
    window.localStorage.setItem(TOKEN_KEY, state.token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }

  if (state.refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, state.refreshToken);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  if (state.idToken) {
    window.localStorage.setItem(ID_TOKEN_KEY, state.idToken);
  } else {
    window.localStorage.removeItem(ID_TOKEN_KEY);
  }

  if (state.role) {
    window.localStorage.setItem(ROLE_KEY, state.role);
  } else {
    window.localStorage.removeItem(ROLE_KEY);
  }
}

export function clearAuthState(): void {
  persistAuthState({ token: "", refreshToken: "", idToken: "", role: null });
}

export function readAuthSubject(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return null;
  }

  return parseJwtSub(token);
}

function parseJwtSub(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { sub?: unknown };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  return window.atob(padded);
}
