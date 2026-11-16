"""Database engine, declarative base and request-scoped sessions."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import resolve_database_url, settings

DATABASE_URL = resolve_database_url(settings.database_url)

# SQLite needs check_same_thread=False because FastAPI serves requests from a
# thread pool; other backends use a plain pooled engine.
_CONNECT_ARGS = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_CONNECT_ARGS, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Declarative base for every Spendflow model."""


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def create_schema() -> None:
    """Create any missing tables. Safe to call on every boot."""
    from . import models  # noqa: F401  (registers the mappers)

    Base.metadata.create_all(bind=engine)
