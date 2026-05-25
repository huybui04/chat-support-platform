import {
  clearAuthState,
  persistAuthState,
  readAuthState,
} from "./auth-storage";
import { refreshKeycloakToken } from "./keycloak-auth";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const authState = readAuthState();
  const method = options.method ?? "GET";
  const shouldRefreshFirst =
    Boolean(authState.token) &&
    Boolean(authState.refreshToken) &&
    isTokenExpiringSoon(authState.token, 60);

  if (shouldRefreshFirst) {
    try {
      const tokenSet = await refreshKeycloakToken(authState.refreshToken);
      persistAuthState({
        token: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        idToken: tokenSet.idToken,
        role: authState.role,
      });

      authState.token = tokenSet.accessToken;
      authState.refreshToken = tokenSet.refreshToken;
      authState.idToken = tokenSet.idToken;
    } catch {
      clearAuthState();
      throw new Error("Session expired. Please sign in again.");
    }
  }

  const response = await sendRequest(path, options, authState.token);

  if (response.status === 401 && authState.refreshToken && method === "GET") {
    let refreshedAccessToken = "";

    try {
      const tokenSet = await refreshKeycloakToken(authState.refreshToken);
      persistAuthState({
        token: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        idToken: tokenSet.idToken,
        role: authState.role,
      });

      refreshedAccessToken = tokenSet.accessToken;
    } catch {
      clearAuthState();
      throw new Error("Session expired. Please sign in again.");
    }

    const retried = await sendRequest(path, options, refreshedAccessToken);
    if (retried.status === 401) {
      clearAuthState();
      throw new Error("Session expired. Please sign in again.");
    }

    if (!retried.ok) {
      throw await toRequestError(retried);
    }

    return (await retried.json()) as T;
  }

  if (!response.ok) {
    throw await toRequestError(response);
  }

  return (await response.json()) as T;
}

async function sendRequest(
  path: string,
  options: RequestOptions,
  token: string,
): Promise<Response> {
  return fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

async function toRequestError(response: Response): Promise<Error> {
  const fallback = `${response.status} ${response.statusText}`;
  const text = await response.text();

  if (!text) {
    return new Error(fallback);
  }

  const normalized = normalizeErrorMessage(text);
  return new Error(normalized || fallback);
}

function normalizeErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const payload = JSON.parse(trimmed) as {
      message?: string | string[];
      error?: string;
      statusCode?: number;
    };

    if (Array.isArray(payload.message) && payload.message.length > 0) {
      return payload.message.join("; ");
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }

    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Non-JSON response, use raw text below.
  }

  return trimmed;
}

function isTokenExpiringSoon(token: string, skewSeconds: number): boolean {
  const exp = readJwtExpiry(token);
  if (!exp) {
    return true;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp - nowSeconds <= skewSeconds;
}

function readJwtExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  return window.atob(padded);
}
