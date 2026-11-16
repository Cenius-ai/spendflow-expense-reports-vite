"""FastAPI application factory, startup seeding and security headers."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy import select

from .config import settings
from .db import SessionLocal, create_schema
from .models import User
from .routers import auth, dashboard, expenses, reports
from .seed import run_seed

logger = logging.getLogger("spendflow")

LANDING_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Spendflow Expense Reports — API</title>
<style>
  :root {
    --background: #f5fbff; --foreground: #0b141b; --card: #fcffff;
    --border: #d9dfe4; --accent: #0074ca; --muted-foreground: #5a656e;
    --font: "Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--background); color: var(--foreground);
         font-family: var(--font); line-height: 1.55; }
  main { width: min(100% - 2rem, 56rem); margin: 0 auto; padding: 4rem 0 6rem; }
  .wordmark { display: inline-flex; align-items: center; gap: .5rem; font-weight: 700;
              letter-spacing: -0.02em; font-size: 1.125rem; text-transform: uppercase; }
  .wordmark span { display: inline-block; width: .625rem; height: .625rem; background: var(--accent); }
  h1 { font-size: clamp(2.25rem, 6vw, 3.5rem); line-height: 1.03; letter-spacing: -0.02em;
       margin: 2.5rem 0 1rem; max-width: 22ch; }
  p.lede { font-size: 1.125rem; color: var(--muted-foreground); max-width: 60ch; margin: 0 0 2.5rem; }
  section { border-top: 1px solid var(--border); padding: 1.75rem 0; }
  h2 { font-size: .75rem; letter-spacing: .08em; text-transform: uppercase;
       color: var(--muted-foreground); margin: 0 0 1rem; font-weight: 600; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: .625rem; }
  li { display: flex; gap: 1rem; align-items: baseline; flex-wrap: wrap; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .875rem;
         background: var(--card); border: 1px solid var(--border); padding: .125rem .375rem; }
  a { color: var(--accent); text-decoration: none; border-bottom: 1px solid currentColor; }
  a:hover { opacity: .8; }
  .creds { background: var(--card); border: 1px solid var(--border); padding: 1rem 1.25rem; }
  .creds p { margin: .25rem 0; }
</style>
</head>
<body>
<main>
  <p class="wordmark"><span></span>Spendflow</p>
  <h1>Expense reports, approvals and reimbursement in one open-source tool.</h1>
  <p class="lede">This is the Spendflow JSON API. The product UI is the Vite + React app
  (<code>npm run dev</code> in <code>frontend/</code>, served on port 5173, proxying
  <code>/api</code> here). Every endpoint below requires a Bearer token from
  <code>POST /api/auth/login</code> except login itself.</p>

  <section>
    <h2>Interactive API docs</h2>
    <ul>
      <li><a href="/docs">Swagger UI</a> — every endpoint with schemas</li>
      <li><a href="/redoc">ReDoc</a> — reference view</li>
      <li><a href="/health">/health</a> — liveness plus a real database check</li>
      <li><a href="/openapi.json">/openapi.json</a> — machine-readable contract</li>
    </ul>
  </section>

  <section>
    <h2>Endpoints</h2>
    <ul>
      <li><code>POST /api/auth/login</code> — email + password → JWT</li>
      <li><code>GET /api/auth/me</code> — current profile</li>
      <li><code>GET /api/reports</code> — role-scoped report list</li>
      <li><code>POST /api/reports</code> — create a draft report</li>
      <li><code>GET /api/reports/{id}</code> — report with expense lines</li>
      <li><code>POST /api/reports/{id}/submit</code> — submit for approval</li>
      <li><code>POST /api/reports/{id}/decision</code> — approve or reject</li>
      <li><code>POST /api/reports/{id}/reimburse</code> — mark reimbursed</li>
      <li><code>POST /api/reports/{id}/expenses</code> — add an expense line</li>
      <li><code>PATCH /api/expenses/{id}</code> — edit an expense line</li>
      <li><code>GET /api/dashboard/summary</code> — status totals and recent activity</li>
      <li><code>GET /api/analytics/spend</code> — spend by category and employee</li>
    </ul>
  </section>

  <section>
    <h2>Demo accounts</h2>
    <div class="creds">
      <p><strong>manager</strong> — cenius@cenius.ai / cenius</p>
      <p><strong>employee</strong> — maya@spendflow.dev / cenius</p>
    </div>
  </section>
</main>
</body>
</html>
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create the schema and seed demo data on every boot (idempotent)."""
    create_schema()
    if settings.seed_on_startup:
        with SessionLocal() as db:
            if db.execute(select(User.id).limit(1)).first() is None:
                logger.info("empty database detected — seeding the Spendflow demo workspace")
                run_seed()
            else:
                run_seed(force_report=False)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description="Open-source expense reports: claims, manager approval and reimbursement.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if response.headers.get("content-type", "").startswith("text/html"):
            # The API landing page ships no scripts, so a strict policy is safe.
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; script-src 'self'"
            )
        return response

    app.include_router(auth.router)
    app.include_router(reports.router)
    app.include_router(expenses.router)
    app.include_router(dashboard.router)

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    def landing() -> HTMLResponse:
        return HTMLResponse(content=LANDING_PAGE, status_code=200)

    @app.get("/health", include_in_schema=False)
    def health() -> JSONResponse:
        try:
            with SessionLocal() as db:
                user_count = len(db.execute(select(User.id).limit(1)).all())
        except Exception:  # pragma: no cover - reports a broken datastore honestly
            logger.exception("health check could not reach the database")
            return JSONResponse({"status": "error", "database": "unreachable"}, status_code=503)
        return JSONResponse({"status": "ok", "database": "ok", "has_users": user_count > 0})

    return app


app = create_app()
