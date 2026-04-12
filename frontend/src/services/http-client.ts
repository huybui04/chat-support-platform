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
  const response = await sendRequest(path, options, authState.token);

  if (response.status === 401 && authState.refreshToken) {
    try {
      const tokenSet = await refreshKeycloakToken(authState.refreshToken);
      persistAuthState({
        token: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        idToken: tokenSet.idToken,
        role: authState.role,
      });

      const retried = await sendRequest(path, options, tokenSet.accessToken);
      if (!retried.ok) {
        throw await toRequestError(retried);
      }

      return (await retried.json()) as T;
    } catch {
      clearAuthState();
      throw new Error("Session expired. Please sign in again.");
    }
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
  return new Error(text || fallback);
}
