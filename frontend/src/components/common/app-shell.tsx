import { useEffect, useMemo, useRef, useState } from "react";
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
import { useAgentRealtime } from "../../store/use-agent-realtime";

type NavItem = {
  label: string;
  to: string;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

type IconProps = {
  className?: string;
};

function HomeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z" />
    </svg>
  );
}

function ChatIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function MailIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm0 2.2V17h16V8.2l-8 5-8-5Z" />
    </svg>
  );
}

function ClockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 5h-2v6l5 3 1-1.73-4-2.27Z" />
    </svg>
  );
}

function ReportIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v12h14V6H5Zm2 9h2v2H7v-2Zm4-6h2v8h-2V9Zm4 3h2v5h-2v-5Z" />
    </svg>
  );
}

function CampaignIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 3h9a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H8l-4 3V4a1 1 0 0 1 1-1Zm11 2h4a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3l-3 2v-2a1 1 0 0 1 1-1h2V7h-1V5Z" />
    </svg>
  );
}

function TeamIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 2c-2.7 0-5 1.34-5 3v2h10v-2c0-1.66-2.3-3-5-3Zm-8 0c-2.7 0-5 1.34-5 3v2h6.5v-2c0-1.2.54-2.28 1.44-3H8Z" />
    </svg>
  );
}

function ProfileIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
    </svg>
  );
}

function LogoutIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 17v-2H5v-6h5V7L4 12l6 5Zm1-10h7a1 1 0 0 1 1 1v2h-2V9h-6V7Zm6 6h2v2a1 1 0 0 1-1 1h-7v-2h6v-1Z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 9 5 5 5-5H7Z" />
    </svg>
  );
}

function AgentHeaderKpis() {
  const { metrics } = useAgentRealtime();

  return (
    <div className="agent-header-kpis">
      <div className="agent-header-kpi active">
        <strong>{metrics.onlineAgents}</strong>
        <span>Active</span>
      </div>
      <div className="agent-header-kpi chat">
        <strong>{metrics.pendingChatCount}</strong>
        <span>Chat</span>
      </div>
      <div className="agent-header-kpi email">
        <strong>{metrics.pendingEmailCount}</strong>
        <span>Email</span>
      </div>
    </div>
  );
}

function HeaderProfileButton({
  name,
  onToggle,
  expanded,
}: {
  name: string;
  onToggle: () => void;
  expanded: boolean;
}) {
  return (
    <button
      type="button"
      className="agent-header-profile-button"
      onClick={onToggle}
      aria-haspopup="menu"
      aria-expanded={expanded}
      aria-label="Open profile menu"
    >
      <ProfileIcon className="agent-header-profile-icon" />
      <span className="agent-header-profile-name">{name}</span>
      <ChevronDownIcon className="agent-header-chevron" />
    </button>
  );
}

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
  { label: "Chat Inbox", to: "/agent/sessions" },
  { label: "Email Inbox", to: "/agent/emails" },
  { label: "All Interaction History", to: "/agent/interactions" },
  // { label: "Chat Window", to: "/agent/chat" },
];

export function AppShell() {
  const location = useLocation();
  const { role, token, logout } = useAuth();
  const [agentUserId, setAgentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
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
      if (!token) {
        if (active) {
          setAgentUserId(null);
          setCurrentUserName(null);
        }
        return;
      }

      try {
        const currentUser = await getCurrentUser();

        if (active) {
          setCurrentUserName(currentUser.fullName);
        }

        if (role !== "agent") {
          return;
        }

        await updateUserStatus(currentUser.id, true);

        if (active) {
          setAgentUserId(currentUser.id);
        }
      } catch {
        if (active) {
          setAgentUserId(null);
          setCurrentUserName(null);
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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    const onDocumentClick = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        event.target instanceof Node &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [profileMenuOpen]);

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
                          {item.label === "Dashboard" ? (
                            <HomeIcon className="nav-icon" />
                          ) : null}
                          {item.label === "All campaigns" ? (
                            <CampaignIcon className="nav-icon" />
                          ) : null}
                          {item.label === "Agents & Team" ? (
                            <TeamIcon className="nav-icon" />
                          ) : null}
                          {item.label === "All Interactions" ? (
                            <ClockIcon className="nav-icon" />
                          ) : null}
                          {item.label === "Reports" ? (
                            <ReportIcon className="nav-icon" />
                          ) : null}
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Link
                      className={isSectionActive ? "active" : ""}
                      to={section.items[0].to}
                    >
                      {section.items[0].label === "Dashboard" ? (
                        <HomeIcon className="nav-icon" />
                      ) : null}
                      {section.items[0].label === "All campaigns" ? (
                        <CampaignIcon className="nav-icon" />
                      ) : null}
                      {section.items[0].label === "Agents & Team" ? (
                        <TeamIcon className="nav-icon" />
                      ) : null}
                      {section.items[0].label === "All Interactions" ? (
                        <ClockIcon className="nav-icon" />
                      ) : null}
                      {section.items[0].label === "Reports" ? (
                        <ReportIcon className="nav-icon" />
                      ) : null}
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
                className={currentPathWithQuery === item.to ? "active" : ""}
                to={item.to}
              >
                {item.label === "Dashboard" ? (
                  <HomeIcon className="nav-icon" />
                ) : null}
                {item.label === "Chat Inbox" ? (
                  <ChatIcon className="nav-icon" />
                ) : null}
                {item.label === "Email Inbox" ? (
                  <MailIcon className="nav-icon" />
                ) : null}
                {item.label === "All Interaction History" ? (
                  <ClockIcon className="nav-icon" />
                ) : null}
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </aside>
      <section className="page-content">
        {role === "agent" ? (
          <header className="app-header agent-header">
            <div className="agent-header-left">
              <span className="agent-header-brand">Support Console</span>
              <span className="agent-header-separator" aria-hidden="true">
                |
              </span>
              <span className="agent-header-title">Agent Workbench</span>
            </div>
            <div className="agent-header-right">
              <AgentHeaderKpis />
              <div className="agent-header-meta">
                <span>{currentTime.toLocaleTimeString()}</span>
                <div className="agent-header-profile" ref={profileMenuRef}>
                  <HeaderProfileButton
                    name={currentUserName ?? "User"}
                    onToggle={() => setProfileMenuOpen((value) => !value)}
                    expanded={profileMenuOpen}
                  />
                  {profileMenuOpen ? (
                    <div className="agent-header-dropdown" role="menu">
                      <button
                        type="button"
                        className="agent-header-menu-item"
                        onClick={() => void onLogout()}
                      >
                        <LogoutIcon className="agent-header-menu-icon" />
                        Log out
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>
        ) : role === "supervisor" ? (
          <header className="app-header agent-header">
            <div className="agent-header-left">
              <span className="agent-header-brand">Support Console</span>
              <span className="agent-header-separator" aria-hidden="true">
                |
              </span>
              <span className="agent-header-title">Supervisor Workbench</span>
            </div>
            <div className="agent-header-right">
              <div className="agent-header-meta">
                <span>{currentTime.toLocaleTimeString()}</span>
                <div className="agent-header-profile" ref={profileMenuRef}>
                  <HeaderProfileButton
                    name={currentUserName ?? "User"}
                    onToggle={() => setProfileMenuOpen((value) => !value)}
                    expanded={profileMenuOpen}
                  />
                  {profileMenuOpen ? (
                    <div className="agent-header-dropdown" role="menu">
                      <button
                        type="button"
                        className="agent-header-menu-item"
                        onClick={() => void onLogout()}
                      >
                        <LogoutIcon className="agent-header-menu-icon" />
                        Log out
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>
        ) : null}
        <Outlet />
      </section>
    </div>
  );
}
