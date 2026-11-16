"""Runtime configuration.

Every value is read from the environment with a working development default so a
fresh clone boots with no ``.env`` present. The JWT secret has a clearly marked
dev fallback (``cenius-dev-...``); set ``JWT_SECRET`` in production.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SQLITE_FILE = "spendflow.db"

# Sanctioned development fallback — never used when JWT_SECRET is provided.
DEV_JWT_SECRET = "cenius-dev-4b7d2f9a6c1e8350d72b6e94af31c8"


class Settings(BaseSettings):
    """Environment-driven settings; unknown injected vars are ignored."""

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Spendflow Expense Reports"
    database_url: str = f"sqlite:///./{DEFAULT_SQLITE_FILE}"
    jwt_secret: str = DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    token_ttl_hours: int = 12
    seed_on_startup: bool = True
    allowed_origins: str = "*"
    demo_password: str = "cenius"

    @field_validator("jwt_secret")
    @classmethod
    def _blank_secret_falls_back(cls, value: str) -> str:
        """An empty JWT_SECRET (e.g. copied from .env.example) is treated as unset."""
        return value.strip() or DEV_JWT_SECRET


def resolve_database_url(raw: str) -> str:
    """Resolve a relative SQLite URL against the backend directory.

    Keeps the database inside the project (never an absolute machine path) while
    staying independent of the process working directory.
    """
    if not raw.startswith("sqlite"):
        return raw
    prefix, separator, path = raw.partition("sqlite:///")
    if not separator or not path:
        return raw
    if path.startswith(("/", ":memory:", "file:")):
        return raw
    return f"{prefix}sqlite:///{(BACKEND_DIR / path).resolve()}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
