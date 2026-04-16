import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import {
  getCurrentUser,
  updateUserStatus,
  updateUserStatusKeepalive,
} from "../../services/admin-api";
import { readAuthState } from "../../services/auth-storage";
import {
  beginKeycloakLogout,
  isKeycloakConfigured,
} from "../../services/keycloak-auth";
import { useAuth } from "../../store/auth-context";

type NavItem = {
  label: string;
  to: string;
};

const supervisorNav: NavItem[] = [
  { label: "Dashboard", to: "/admin/dashboard" },
  { label: "Campaigns", to: "/admin/campaigns" },
  { label: "Agents", to: "/admin/agents" },
  { label: "Teams", to: "/admin/teams" },
  { label: "Contacts", to: "/admin/contacts" },
  { label: "Reports", to: "/admin/reports" },
];

const agentNav: NavItem[] = [
  { label: "Dashboard", to: "/agent/dashboard" },
  { label: "Session List", to: "/agent/sessions" },
  // { label: "Chat Window", to: "/agent/chat" },
];

export function AppShell() {
  const location = useLocation();
  const { role, token, logout } = useAuth();
  const navItems = role === "supervisor" ? supervisorNav : agentNav;
  const [agentUserId, setAgentUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const markOnline = async () => {
      if (role !== "agent" || !token) {
        if (active) {
          setAgentUserId(null);
        }
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        await updateUserStatus(currentUser.id, true);

        if (active) {
          setAgentUserId(currentUser.id);
        }
      } catch {
        if (active) {
          setAgentUserId(null);
        }
      }
    };

    void markOnline();

    return () => {
      active = false;
    };
  }, [role, token]);

  useEffect(() => {
    if (role !== "agent" || !agentUserId || !token) {
      return;
    }

    const onPageHide = () => {
      updateUserStatusKeepalive(agentUserId, false, token);
    };

    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [agentUserId, role, token]);

  useEffect(() => {
    if (role !== "agent" || !agentUserId || !token) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void updateUserStatus(agentUserId, true);
    }, 45_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [agentUserId, role, token]);

  const onLogout = async () => {
    if (role === "agent" && agentUserId) {
      try {
        await updateUserStatus(agentUserId, false);
      } catch {
        // Continue logout even if status update fails.
      }
    }

    const current = readAuthState();
    logout();

    if (isKeycloakConfigured()) {
      await beginKeycloakLogout({
        refreshToken: current.refreshToken,
        idTokenHint: current.idToken,
      });
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <p className="brand">Support Console</p>
        <p className="role-tag">Role: {role}</p>
        <nav>
          {navItems.map((item) => (
            <Link
              key={item.to}
              className={location.pathname === item.to ? "active" : ""}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="secondary"
          onClick={() => void onLogout()}
        >
          Logout
        </button>
      </aside>
      <section className="page-content">
        <Outlet />
      </section>
    </div>
  );
}
