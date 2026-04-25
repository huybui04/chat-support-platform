import { useEffect, useMemo, useState } from "react";
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

type NavSection = {
  label: string;
  items: NavItem[];
};

const supervisorNav: NavSection[] = [
  {
    label: "Dashboard",
    items: [{ label: "Dashboard", to: "/admin/dashboard" }],
  },
  {
    label: "Campaign management",
    items: [
      { label: "All campaigns", to: "/admin/campaigns?tab=list" },
      { label: "Agents & Team", to: "/admin/agents" },
    ],
  },
  {
    label: "Interaction History",
    items: [{ label: "All Interactions", to: "/admin/contacts" }],
  },
  {
    label: "Reports",
    items: [{ label: "Reports", to: "/admin/reports" }],
  },
];

const agentNav: NavItem[] = [
  { label: "Dashboard", to: "/agent/dashboard" },
  { label: "Session List", to: "/agent/sessions" },
  // { label: "Chat Window", to: "/agent/chat" },
];

export function AppShell() {
  const location = useLocation();
  const { role, token, logout } = useAuth();
  const [agentUserId, setAgentUserId] = useState<string | null>(null);
  const currentPathWithQuery = `${location.pathname}${location.search}`;

  const activeSupervisorTopSection = useMemo(() => {
    if (location.pathname.startsWith("/admin/campaigns")) {
      return "Campaign management";
    }

    if (
      location.pathname.startsWith("/admin/agents") ||
      location.pathname.startsWith("/admin/teams")
    ) {
      return "Campaign management";
    }

    if (location.pathname === "/admin/dashboard") {
      return "Dashboard";
    }

    if (location.pathname === "/admin/reports") {
      return "Reports";
    }

    return "Interaction History";
  }, [location.pathname]);

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
        {role === "supervisor" ? (
          <nav className="sidebar-supervisor-nav">
            {supervisorNav.map((section) => {
              const isSectionActive =
                section.label === activeSupervisorTopSection;

              return (
                <div key={section.label} className="sidebar-nav-section">
                  <p className="sidebar-nav-section-title">{section.label}</p>
                  {section.items.length > 1 ? (
                    <div className="sidebar-subnav">
                      {section.items.map((item) => (
                        <Link
                          key={item.to}
                          className={
                            currentPathWithQuery === item.to ? "active" : ""
                          }
                          to={item.to}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Link
                      className={isSectionActive ? "active" : ""}
                      to={section.items[0].to}
                    >
                      {section.items[0].label}
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>
        ) : (
          <nav>
            {agentNav.map((item) => (
              <Link
                key={item.to}
                className={location.pathname === item.to ? "active" : ""}
                to={item.to}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
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
