import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { useAuth } from "./auth/AuthContext.jsx";
import AppHeader from "./components/AppHeader.jsx";
import ApprovalsPage from "./pages/ApprovalsPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import ReportDetailPage from "./pages/ReportDetailPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";

function BootScreen() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <p className="eyebrow">Spendflow</p>
        <h1 style={{ fontSize: "var(--text-title)", marginTop: "var(--space-2)" }}>
          Loading your workspace…
        </h1>
      </main>
    </div>
  );
}

function ProtectedLayout() {
  const { isAuthenticated, validating } = useAuth();
  const location = useLocation();

  if (validating && !isAuthenticated) return <BootScreen />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <div className="app-footer__inner">
          <span>Spendflow Expense Reports — open source, self-hosted.</span>
          <span>Single-step manager approval · USD only</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/:id" element={<ReportDetailPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
