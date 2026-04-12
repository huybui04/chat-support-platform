import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/common/app-shell";
import { AdminAgentsPage } from "../pages/admin/agents-page";
import { AdminCampaignsPage } from "../pages/admin/campaigns-page";
import { AdminContactsPage } from "../pages/admin/contacts-page";
import { AdminDashboardPage } from "../pages/admin/dashboard-page";
import { AdminReportsPage } from "../pages/admin/reports-page";
import { AdminTeamsPage } from "../pages/admin/teams-page";
import { AgentChatWindowPage } from "../pages/agent/chat-window-page";
import { AgentDashboardPage } from "../pages/agent/dashboard-page";
import { AgentSessionListPage } from "../pages/agent/session-list-page";
import { AuthCallbackPage } from "../pages/auth/auth-callback-page";
import { LoginPage } from "../pages/auth/login-page";
import { useAuth } from "../store/auth-context";
import { PrivateRoute } from "./private-route";

export function AppRoutes() {
  const { role, isAuthenticated } = useAuth();
  const defaultPath = role
    ? role === "supervisor"
      ? "/admin/dashboard"
      : "/agent/dashboard"
    : isAuthenticated
      ? "/agent/dashboard"
      : "/login";

  return (
    <Routes>
      <Route path="/" element={<Navigate to={defaultPath} replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route element={<PrivateRoute allowedRoles={["supervisor"]} />}>
        <Route element={<AppShell />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/campaigns" element={<AdminCampaignsPage />} />
          <Route path="/admin/agents" element={<AdminAgentsPage />} />
          <Route path="/admin/teams" element={<AdminTeamsPage />} />
          <Route path="/admin/contacts" element={<AdminContactsPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
        </Route>
      </Route>

      <Route element={<PrivateRoute allowedRoles={["agent"]} />}>
        <Route element={<AppShell />}>
          <Route path="/agent/dashboard" element={<AgentDashboardPage />} />
          <Route path="/agent/sessions" element={<AgentSessionListPage />} />
          <Route path="/agent/chat" element={<AgentChatWindowPage />} />
          <Route
            path="/agent/chat/:sessionId"
            element={<AgentChatWindowPage />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
