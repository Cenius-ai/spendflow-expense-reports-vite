"""Compatibility entry point.

The documented launch command is ``uvicorn app.main:app`` from ``backend/``.
This module makes ``uvicorn main:app`` work as well, so tooling that guesses the
conventional FastAPI entry point still boots the same application.
"""

from app.main import app

__all__ = ["app"]
