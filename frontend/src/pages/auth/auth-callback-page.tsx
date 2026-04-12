import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { getCurrentUser } from "../../services/admin-api";
import { clearAuthState, persistAuthState } from "../../services/auth-storage";
import {
  consumePostLoginPath,
  exchangeKeycloakCodeForToken,
} from "../../services/keycloak-auth";
import { useAuth } from "../../store/auth-context";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    const completeLogin = async () => {
      try {
        const tokenSet = await exchangeKeycloakCodeForToken();

        // Store token early so API requests can attach Authorization header.
        persistAuthState({
          token: tokenSet.accessToken,
          refreshToken: tokenSet.refreshToken,
          idToken: tokenSet.idToken,
          role: null,
        });
        const currentUser = await getCurrentUser();

        login(tokenSet.accessToken, currentUser.role, {
          refreshToken: tokenSet.refreshToken,
          idToken: tokenSet.idToken,
        });
        const fallback =
          currentUser.role === "supervisor"
            ? "/admin/dashboard"
            : "/agent/dashboard";

        navigate(consumePostLoginPath() ?? fallback, { replace: true });
      } catch (error) {
        clearAuthState();
        const message =
          error instanceof Error ? error.message : "Keycloak login failed.";
        navigate(`/login?error=${encodeURIComponent(message)}`, {
          replace: true,
        });
      }
    };

    void completeLogin();
  }, [login, navigate]);

  return (
    <main className="auth-page">
      <div className="login-card">
        <p className="eyebrow">Customer Support Platform</p>
        <h1>Completing sign in</h1>
        <p className="subtitle callback-note">
          Please wait while we finish your Keycloak authentication.
        </p>
      </div>
    </main>
  );
}
