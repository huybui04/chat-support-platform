import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../store/auth-context";
import type { UserRole } from "../types/auth";

type PrivateRouteProps = {
  allowedRoles: UserRole[];
};

export function PrivateRoute({ allowedRoles }: PrivateRouteProps) {
  const location = useLocation();
  const { isAuthenticated, isHydratingRole, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (isHydratingRole) {
    return (
      <main className="auth-page">
        <div className="login-card">
          <p className="eyebrow">Customer Support Platform</p>
          <h1>Verifying session</h1>
          <p className="subtitle callback-note">
            Restoring your account role and permissions.
          </p>
        </div>
      </main>
    );
  }

  if (!role) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!allowedRoles.includes(role)) {
    return (
      <Navigate
        to={role === "agent" ? "/agent/dashboard" : "/admin/dashboard"}
        replace
      />
    );
  }

  return <Outlet />;
}
