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
  const [isLoading, setIsLoading] = useState(false);
  const [tenantId, setTenantId] = useState("");

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
    const targetTenant = tenantId.trim();
    if (!targetTenant) {
      setActionError("Please enter Tenant ID.");
      return;
    }

    setIsLoading(true);

    try {
      // Validate if the tenant/realm exists by fetching its openid-configuration
      const defaultIssuer = import.meta.env.VITE_KEYCLOAK_ISSUER?.trim() || "";
      const realmsIndex = defaultIssuer.indexOf("/realms/");
      const baseUrl = realmsIndex !== -1 ? defaultIssuer.substring(0, realmsIndex) : defaultIssuer;
      const wellKnownUrl = `${baseUrl.replace(/\/$/, "")}/realms/${targetTenant}/.well-known/openid-configuration`;

      const response = await fetch(wellKnownUrl, { method: "GET" });
      if (!response.ok) {
        throw new Error("Tenant ID not exists.");
      }

      window.localStorage.setItem("chat_platform_last_realm", targetTenant);
      await beginKeycloakLogin(targetTenant, from ?? fallback);
    } catch (error) {
      setActionError("The tenant ID does not exist or is invalid. Please check again.");
    } finally {
      setIsLoading(false);
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
              Enter your Tenant ID to sign in to Admin Portal or Agent Portal.
            </p>
            <label style={{ display: "grid", gap: "6px", marginBottom: "14px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>Tenant ID</span>
              <input
                type="text"
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
                placeholder="Enter your Tenant ID"
                disabled={isLoading}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  fontSize: "14px",
                  fontFamily: "inherit",
                }}
              />
            </label>
            <button type="button" onClick={onKeycloakSignIn} disabled={!tenantId.trim() || isLoading}>
              {isLoading ? "Validating..." : "Next"}
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
