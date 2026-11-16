#!/usr/bin/env bash
# Spendflow Expense Reports — setup.
#
# Installs Python and Node dependencies, creates the SQLite schema, seeds the
# demo workspace and verifies that the frontend compiles. It NEVER starts a
# server: run ./start.sh (or the two dev commands) afterwards.
#
# Written with POSIX-safe syntax so `sh install.sh` and `bash install.sh` both work.
set -eu
cd "$(dirname "$0")"

echo "==> Spendflow setup"
echo "    working directory: $(pwd)"

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 (3.11+) is required. See INSTALL.md for prerequisites." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: node + npm (Node 20+) are required. See INSTALL.md for prerequisites." >&2
  exit 1
fi

echo "==> 1/4 Python dependencies"
python3 -m pip install --upgrade pip setuptools wheel >/dev/null 2>&1 || true
if ! python3 -m pip install -r backend/requirements.txt; then
  echo "    retrying with --break-system-packages (PEP 668 managed environment)"
  python3 -m pip install --break-system-packages -r backend/requirements.txt
fi

echo "==> 2/4 JWT signing secret"
if [ -f backend/.env ] && grep -q '^JWT_SECRET=' backend/.env 2>/dev/null; then
  echo "    backend/.env already provides JWT_SECRET"
else
  SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
  if [ -f backend/.env ]; then
    printf 'JWT_SECRET=%s\n' "$SECRET" >> backend/.env
  else
    printf 'JWT_SECRET=%s\n' "$SECRET" > backend/.env
  fi
  echo "    wrote a fresh JWT_SECRET to backend/.env"
fi

echo "==> 3/4 SQLite schema + demo data"
( cd backend && python3 -m seed )

echo "==> 4/4 Frontend dependencies and production build check"
( cd frontend && npm install --no-audit --no-fund && npm run build )

echo ""
echo "Setup complete."
echo "Start both services with:  sh start.sh"
echo "  backend  http://localhost:8000  (API + /docs)"
echo "  frontend http://localhost:5173  (product UI)"
echo "Demo login: cenius@cenius.ai / cenius (manager), maya@spendflow.dev / cenius (employee)"
