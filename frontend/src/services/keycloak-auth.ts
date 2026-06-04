const LOGIN_STATE_KEY = "chat_platform_oidc_state";
const LOGIN_VERIFIER_KEY = "chat_platform_oidc_verifier";
const LOGIN_RETURN_PATH_KEY = "chat_platform_oidc_return_path";
const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1";

export type KeycloakTokenSet = {
  accessToken: string;
  refreshToken: string;
  idToken: string;
};

type TokenResponse = {
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  tokenType?: string;
  expiresIn?: number;
  error?: string;
  error_description?: string;
};

type ApiResponse<T> = {
  success: true;
  data: T;
};

function readConfig() {
  const issuer = import.meta.env.VITE_KEYCLOAK_ISSUER?.trim();
  const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID?.trim();
  const scope =
    import.meta.env.VITE_KEYCLOAK_SCOPE?.trim() || "openid profile email";
  const redirectUri =
    import.meta.env.VITE_KEYCLOAK_REDIRECT_URI?.trim() ||
    `${window.location.origin}/auth/callback`;

  return { issuer, clientId, scope, redirectUri };
}

export function isKeycloakConfigured(): boolean {
  const config = readConfig();
  return Boolean(config.issuer && config.clientId);
}

function decodeJwt(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export async function beginKeycloakLogin(
  realm: string,
  returnPath?: string,
): Promise<void> {
  const { issuer: defaultIssuer, clientId, scope, redirectUri } = readConfig();
  if (!defaultIssuer || !clientId) {
    throw new Error(
      "Missing Keycloak config. Set VITE_KEYCLOAK_ISSUER and VITE_KEYCLOAK_CLIENT_ID.",
    );
  }

  const realmsIndex = defaultIssuer.indexOf("/realms/");
  const baseUrl =
    realmsIndex !== -1
      ? defaultIssuer.substring(0, realmsIndex)
      : defaultIssuer;
  const issuer = `${baseUrl}/realms/${realm}`;

  const state = createRandomString(24);
  const verifier = createRandomString(64);
  const challenge = await createCodeChallenge(verifier);

  window.sessionStorage.setItem(LOGIN_STATE_KEY, state);
  window.sessionStorage.setItem(LOGIN_VERIFIER_KEY, verifier);
  window.sessionStorage.setItem("chat_platform_oidc_realm", realm);
  if (returnPath) {
    window.sessionStorage.setItem(LOGIN_RETURN_PATH_KEY, returnPath);
  }

  const authorizeUrl = new URL(
    `${trimTrailingSlash(issuer)}/protocol/openid-connect/auth`,
  );
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  window.location.assign(authorizeUrl.toString());
}


export async function exchangeKeycloakCodeForToken(
  currentUrl: string = window.location.href,
): Promise<KeycloakTokenSet> {
  const { redirectUri } = readConfig();

  const url = new URL(currentUrl);
  const error = url.searchParams.get("error");
  if (error) {
    throw new Error(url.searchParams.get("error_description") || error);
  }

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const expectedState = window.sessionStorage.getItem(LOGIN_STATE_KEY);
  const verifier = window.sessionStorage.getItem(LOGIN_VERIFIER_KEY);
  const realm = window.sessionStorage.getItem("chat_platform_oidc_realm");

  if (!code || !returnedState || !expectedState || !verifier) {
    throw new Error("Invalid Keycloak callback payload.");
  }

  if (returnedState !== expectedState) {
    throw new Error("State mismatch while validating Keycloak login.");
  }

  clearPkceArtifacts();

  const payload = {
    code,
    redirectUri: redirectUri,
    codeVerifier: verifier,
    realm: realm || undefined,
  };

  const data = await authApiRequest<TokenResponse>("/auth/login", payload);
  if (!data.accessToken) {
    throw new Error("Unable to fetch access token from auth/login.");
  }

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? "",
    idToken: data.idToken ?? "",
  };
}

export async function refreshKeycloakToken(
  refreshToken: string,
): Promise<KeycloakTokenSet> {
  if (!refreshToken) {
    throw new Error("Missing refresh token.");
  }

  const data = await authApiRequest<TokenResponse>("/auth/refresh", {
    refreshToken,
  });
  if (!data.accessToken) {
    throw new Error("Unable to refresh access token.");
  }

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? refreshToken,
    idToken: data.idToken ?? "",
  };
}

export async function beginKeycloakLogout(input?: {
  refreshToken?: string;
  idTokenHint?: string;
}): Promise<void> {
  let { issuer, clientId } = readConfig();

  const activeToken = input?.idTokenHint || input?.refreshToken;
  if (activeToken) {
    const decoded = decodeJwt(activeToken);
    if (decoded?.iss) {
      issuer = decoded.iss;
    }
  }

  if (input?.refreshToken) {
    try {
      const decoded = decodeJwt(input.refreshToken);
      let realm: string | undefined = undefined;
      if (decoded?.iss) {
        const match = decoded.iss.match(/\/realms\/([^/]+)$/);
        if (match) {
          realm = match[1];
        }
      }

      await authApiRequest<{ loggedOut: true }>("/auth/logout", {
        refreshToken: input.refreshToken,
        realm,
      });
    } catch {
      // Ignore API failure and continue with browser redirect logout.
    }
  }

  if (!issuer || !clientId) {
    window.location.assign("/login");
    return;
  }

  const redirectUri =
    import.meta.env.VITE_KEYCLOAK_POST_LOGOUT_REDIRECT_URI?.trim() ||
    `${window.location.origin}/login`;

  const logoutUrl = new URL(
    `${trimTrailingSlash(issuer)}/protocol/openid-connect/logout`,
  );
  logoutUrl.searchParams.set("client_id", clientId);
  logoutUrl.searchParams.set("post_logout_redirect_uri", redirectUri);
  if (input?.idTokenHint) {
    logoutUrl.searchParams.set("id_token_hint", input.idTokenHint);
  }

  window.location.assign(logoutUrl.toString());
}


async function authApiRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `${response.status} ${response.statusText}`);
  }

  const parsed = JSON.parse(text) as ApiResponse<T>;
  return parsed.data;
}

export function consumePostLoginPath(): string | null {
  const returnPath = window.sessionStorage.getItem(LOGIN_RETURN_PATH_KEY);
  window.sessionStorage.removeItem(LOGIN_RETURN_PATH_KEY);
  return returnPath;
}

function clearPkceArtifacts() {
  window.sessionStorage.removeItem(LOGIN_STATE_KEY);
  window.sessionStorage.removeItem(LOGIN_VERIFIER_KEY);
  window.sessionStorage.removeItem("chat_platform_oidc_realm");
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function createRandomString(length: number): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);

  let output = "";
  for (const value of bytes) {
    output += alphabet[value % alphabet.length];
  }

  return output;
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
