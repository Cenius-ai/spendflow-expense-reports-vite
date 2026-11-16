# Installation

Spendflow is two small services and an embedded database. There is nothing to
provision and no service to install system-wide.

## 1. Prerequisites (install these yourself)

| Tool | Version | Why |
| --- | --- | --- |
| Python | 3.11 or newer, with `pip` | runs the FastAPI backend |
| Node.js | 20 or newer, with `npm` | builds and serves the React UI |
| `sqlite3` | optional CLI | handy for inspecting `backend/spendflow.db` |

No database server, no Docker, no Redis, no network access at runtime. On Debian/
Ubuntu, `build-essential` and `libsqlite3-dev` are enough if `bcrypt` ever needs to
compile (wheels normally exist, so this is rare).

## 2. Install everything (single step)

From the repository root:

```bash
sh install.sh
```

That script, in order:

1. installs the Python dependencies from `backend/requirements.txt`
   (retrying with `--break-system-packages` on PEP 668 managed environments);
2. writes a random `JWT_SECRET` into `backend/.env` if one is not already there;
3. creates the SQLite schema and seeds the demo workspace (idempotent — safe to re-run);
4. installs the frontend dependencies and runs a production build to prove the UI compiles.

It never starts a server, and it exits non-zero if any step fails.

## 3. Seed the database (its own step)

`install.sh` already does this, but the command is standalone and idempotent:

```bash
cd backend
python3 -m seed
```

Expected output on a fresh checkout:

```
Spendflow seed: users=4 new_reports=13 new_expenses=32
```

Running it a second time prints `new_reports=0 new_expenses=0` — nothing is
duplicated. The backend also auto-seeds on boot when the users table is empty, so
a fresh clone that skips this step still starts with demo data.

## 4. Run it in development

Both services in one foreground process:

```bash
sh start.sh
```

or, one terminal each:

```bash
cd backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
cd frontend && npm run dev
```

| Service | URL |
| --- | --- |
| Product UI | <http://localhost:5173> |
| API landing page | <http://localhost:8000> |
| Swagger UI | <http://localhost:8000/docs> |
| Health check | <http://localhost:8000/health> |

Sign in with `cenius@cenius.ai` / `cenius` (manager) or `maya@spendflow.dev` /
`cenius` (employee).

## 5. Verify

```bash
cd backend && python3 -m pytest      # 26 API / workflow / analytics tests
cd frontend && npm test              # formatting and validation units
```

## Resetting the demo data

```bash
rm backend/spendflow.db
cd backend && python3 -m seed
```

## Production notes

- Set `JWT_SECRET` to a long random value (or let `install.sh` generate one in
  `backend/.env`) and keep `backend/.env` out of version control.
- Point `DATABASE_URL` at Postgres if you prefer: `pip install psycopg2-binary` and set
  `DATABASE_URL=postgresql+psycopg2://user:pass@host/db`. The schema is created on
  boot either way.
- Serve the built frontend (`frontend/dist`) from any static host that proxies `/api`
  to the backend, or keep using the Vite dev server behind a reverse proxy.
- Demo accounts ship with the seed. Delete them or replace the seed before exposing a
  real deployment.
