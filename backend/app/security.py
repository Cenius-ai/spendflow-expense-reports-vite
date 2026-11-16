"""Password hashing (bcrypt) and JWT session tokens (PyJWT, HS256)."""

from __future__ import annotations

from datetime import datetime, timedelta

import bcrypt
import jwt

from .config import settings
from .models import utcnow

# bcrypt silently truncates beyond 72 bytes; truncate explicitly so hashing and
# verification always look at the same prefix.
_BCRYPT_MAX_BYTES = 72


def _to_bcrypt_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_to_bcrypt_bytes(password), bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    """Constant-time bcrypt comparison; a malformed hash simply fails closed."""
    if not password or not password_hash:
        return False
    try:
        return bcrypt.checkpw(_to_bcrypt_bytes(password), password_hash.encode("ascii"))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int) -> tuple[str, datetime]:
    issued_at = utcnow()
    expires_at = issued_at + timedelta(hours=settings.token_ttl_hours)
    payload = {
        "sub": str(user_id),
        "iat": int(issued_at.replace(tzinfo=None).timestamp()),
        "exp": int(expires_at.replace(tzinfo=None).timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_at


def decode_access_token(token: str) -> int | None:
    """Verify signature + expiry with a pinned algorithm; return the user id."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],  # pinned: never trust the header alg
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError:
        return None
    subject = payload.get("sub")
    try:
        return int(subject)
    except (TypeError, ValueError):
        return None
