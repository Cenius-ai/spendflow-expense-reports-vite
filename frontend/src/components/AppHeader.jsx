import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.jsx";
import { initials } from "../lib/format.js";

export default function AppHeader() {
  const { user, logout, isManager } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/reports", label: "Reports" },
  ];
  if (isManager) links.push({ to: "/approvals", label: "Approvals" });

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link to="/dashboard" className="wordmark">
          <span className="wordmark__mark" aria-hidden="true" />
          Spendflow
        </Link>

        <nav className="app-nav" aria-label="Main">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className="app-nav__link">
              {link.label}
            </NavLink>
          ))}
        </nav>

        <span className="app-header__spacer" />

        {user ? (
          <div className="user-chip">
            <span className="user-chip__avatar" aria-hidden="true">
              {initials(user.full_name)}
            </span>
            <span className="user-chip__text">
              <span className="user-chip__name">{user.full_name}</span>
              <span className="user-chip__role">{user.role}</span>
            </span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
              Log out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
