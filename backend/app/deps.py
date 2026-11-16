"""Request dependencies: bearer-token auth, role gates and report scoping."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models import Report, Role, User
from .security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)

CREDENTIALS_ERROR = "Not authenticated"


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the caller from a verified Bearer JWT — never from request data."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=CREDENTIALS_ERROR,
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=CREDENTIALS_ERROR,
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=CREDENTIALS_ERROR,
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_manager(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a manager can perform this action",
        )
    return current_user


def load_report_for_reader(db: Session, viewer: User, report_id: int) -> Report:
    """Fetch a report the viewer is allowed to read.

    Employees may only read their own reports (403 on someone else's, so the API
    never leaks whether a foreign id exists); managers may read anything. The
    check is server-side and identical for reads and writes.
    """
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if not viewer.is_manager and report.owner_id != viewer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This report belongs to another employee",
        )
    return report


def load_own_report(db: Session, viewer: User, report_id: int) -> Report:
    """Fetch a report the viewer owns (employees edit their own drafts)."""
    report = load_report_for_reader(db, viewer, report_id)
    if report.owner_id != viewer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the report owner can change this report",
        )
    return report


__all__ = [
    "Role",
    "bearer_scheme",
    "get_current_user",
    "load_own_report",
    "load_report_for_reader",
    "require_manager",
]
