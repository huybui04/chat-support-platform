import { useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  beginKeycloakLogin,
  isKeycloakConfigured,
} from "../../services/keycloak-auth";
import { useAuth } from "../../store/auth-context";
import type { UserRole } from "../../types/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const keycloakEnabled = isKeycloakConfigured();

  const [token, setToken] = useState("");
  const [role, setRole] = useState<UserRole>("agent");
  const [actionError, setActionError] = useState<string | null>(null);

  const callbackError = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("error");
  }, [location.search]);

  const from = (location.state as { from?: string } | null)?.from;
  const fallback =
    role === "supervisor" ? "/admin/dashboard" : "/agent/dashboard";

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token.trim()) {
      return;
    }

    login(token.trim(), role, { refreshToken: "", idToken: "" });
    navigate(from ?? fallback, { replace: true });
  };

  const onKeycloakSignIn = async () => {
    setActionError(null);

    try {
      await beginKeycloakLogin(from ?? fallback);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to start Keycloak login.";
      setActionError(message);
    }
  };

  return (
    <main className="auth-page">
      <form className="login-card" onSubmit={onSubmit}>
        <p className="eyebrow">Customer Support Platform</p>
        <h1>Portal Login</h1>

        {callbackError ? <p className="error-note">{callbackError}</p> : null}
        {actionError ? <p className="error-note">{actionError}</p> : null}

        {keycloakEnabled ? (
          <>
            <p className="subtitle">
              Sign in with Keycloak to access Admin Portal or Agent Portal.
            </p>
            <button type="button" onClick={onKeycloakSignIn}>
              Sign in with Keycloak
            </button>
          </>
        ) : (
          <>
            <p className="subtitle">
              Keycloak env vars are missing. Using local token fallback for
              development.
            </p>
            <label>
              Access Token
              <textarea
                value={token}
                onChange={(event) => setToken(event.target.value)}
                rows={5}
                placeholder="Paste JWT token"
              />
            </label>

            <label>
              Role
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                <option value="agent">agent</option>
                <option value="supervisor">supervisor</option>
              </select>
            </label>

            <button type="submit">Sign in</button>
          </>
        )}
      </form>
    </main>
  );
}
