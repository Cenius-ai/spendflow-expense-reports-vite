import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.jsx";
import { validateLogin } from "../lib/validation.js";
import useDocumentTitle from "../lib/useDocumentTitle.js";

const DEMO_ACCOUNTS = [
  { role: "Manager", email: "cenius@cenius.ai", password: "cenius" },
  { role: "Employee", email: "maya@spendflow.dev", password: "cenius" },
];

export default function LoginPage() {
  useDocumentTitle("Sign in");
  const { login, isAuthenticated, expired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  // Return to the route the visitor originally asked for, otherwise land on the
  // dashboard (the app root is also the dashboard, but /dashboard is explicit).
  const requested = location.state?.from;
  const redirectTo = requested && !["/", "/login"].includes(requested) ? requested : "/dashboard";

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  function focusField(field) {
    if (field === "email") emailRef.current?.focus();
    else passwordRef.current?.focus();
  }

  async function attempt(credentials) {
    if (busy) return;
    const found = validateLogin(credentials);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setFormError("");
      focusField(Object.keys(found)[0]);
      return;
    }
    setBusy(true);
    setFormError("");
    setErrors({});
    try {
      await login(credentials.email.trim().toLowerCase(), credentials.password);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(error.message || "Invalid email or password");
      emailRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    attempt({ email, password });
  }

  function useDemoAccount(account) {
    setEmail(account.email);
    setPassword(account.password);
    attempt({ email: account.email, password: account.password });
  }

  return (
    <div className="login">
      <section className="login__brand">
        <div>
          <p className="wordmark">
            <span className="wordmark__mark" aria-hidden="true" />
            Spendflow
          </p>
          <h1 className="login__headline" style={{ marginTop: "var(--space-8)" }}>
            Expense reports that stop living in spreadsheets.
          </h1>
          <p className="login__lede">
            Capture the receipt, pick a category, submit the report. A manager approves it with a
            note and reimbursement is tracked to the dollar — all in one place your team can
            self-host.
          </p>
        </div>
        <ul className="login__points">
          <li>Line-by-line claims with a running total</li>
          <li>Single-step manager approval with a written decision</li>
          <li>Draft → Submitted → Approved → Reimbursed, always visible</li>
          <li>Spend by category and by employee, straight from your data</li>
        </ul>
      </section>

      <section className="login__panel">
        <div className="login__card">
          <div>
            <h2>Sign in</h2>
            <p className="login__hint">
              Accounts are provisioned by your finance team. Use a demo account below to explore
              the workspace.
            </p>
          </div>

          {expired && !formError ? (
            <div className="banner banner--info" role="status">
              <span>Your session expired. Sign in again to pick up where you left off.</span>
            </div>
          ) : null}

          {formError ? (
            <div className="banner banner--error" role="alert">
              <span>{formError}</span>
            </div>
          ) : null}

          <form className="form-grid" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="login-email">
                Work email
              </label>
              <input
                id="login-email"
                ref={emailRef}
                className="input"
                type="email"
                name="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={errors.email ? "true" : undefined}
                aria-describedby={errors.email ? "login-email-error" : undefined}
              />
              {errors.email ? (
                <span className="field__error" id="login-email-error">
                  {errors.email}
                </span>
              ) : null}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="login-password">
                Password
              </label>
              <div className="password-field">
                <input
                  id="login-password"
                  ref={passwordRef}
                  className="input"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={errors.password ? "true" : undefined}
                  aria-describedby={errors.password ? "login-password-error" : undefined}
                />
                <button
                  type="button"
                  className="password-field__toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password ? (
                <span className="field__error" id="login-password-error">
                  {errors.password}
                </span>
              ) : null}
            </div>

            <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="demo-block">
            <span className="demo-block__title">Demo accounts</span>
            {DEMO_ACCOUNTS.map((account) => (
              <div className="demo-cred" key={account.email}>
                <span className="demo-cred__id">
                  <span className="demo-cred__email">{account.email}</span>
                  <span className="demo-cred__role">
                    {account.role} · password{" "}
                    <span className="demo-cred__password">{account.password}</span>
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => useDemoAccount(account)}
                  disabled={busy}
                >
                  Use this account
                </button>
              </div>
            ))}
            <p className="login__hint">Demo: cenius@cenius.ai / cenius</p>
          </div>
        </div>
      </section>
    </div>
  );
}
