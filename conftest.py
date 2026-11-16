"""Pytest bootstrap: put backend/ on sys.path and use a throwaway SQLite file."""

import os
import sys
import tempfile
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Must be set before app.config / app.db are imported (engine is built at import).
os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{Path(tempfile.mkdtemp(prefix='spendflow-tests-')) / 'test.db'}",
)
