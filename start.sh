#!/usr/bin/env bash
# Spendflow Expense Reports — run both services in the foreground.
#
#   backend : FastAPI   on 0.0.0.0:${PORT:-8000}
#   frontend: Vite dev  on 0.0.0.0:${FRONTEND_PORT:-5173}, proxying /api to the backend
#
# Installs nothing. Run ./install.sh first.
set -eu
cd "$(dirname "$0")"

BACKEND_PORT="${PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

if [ ! -d frontend/node_modules ]; then
  echo "ERROR: frontend dependencies are missing. Run: sh install.sh" >&2
  exit 1
fi

BACKEND_PID=""
cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "==> starting FastAPI on 0.0.0.0:${BACKEND_PORT}"
( cd backend && exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" ) &
BACKEND_PID=$!

ready=0
i=0
while [ "$i" -lt 60 ]; do
  if python3 - "$BACKEND_PORT" <<'PY'
import sys, urllib.request
port = sys.argv[1]
try:
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1) as response:
        sys.exit(0 if response.status == 200 else 1)
except Exception:
    sys.exit(1)
PY
  then
    ready=1
    break
  fi
  i=$((i + 1))
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "ERROR: the backend did not answer /health within 60s" >&2
  exit 1
fi

echo "==> backend ready: http://localhost:${BACKEND_PORT}"
echo "==> starting Vite dev server on 0.0.0.0:${FRONTEND_PORT} (proxying /api)"
cd frontend
API_PROXY_TARGET="http://127.0.0.1:${BACKEND_PORT}" \
  node ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port "$FRONTEND_PORT" --strictPort
