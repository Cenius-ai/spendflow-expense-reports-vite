"""Auth endpoints: email + password login and current-user profile."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import User
from ..ratelimit import login_limiter
from ..schemas import LoginRequest, LoginResponse, UserOut
from ..security import create_access_token, verify_password
from ..serializers import user_out

router = APIRouter(prefix="/api/auth", tags=["auth"])

# One message for both unknown email and wrong password: never enumerate accounts.
INVALID_CREDENTIALS = "Invalid email or password"


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> LoginResponse:
    client_ip = request.client.host if request.client else "unknown"
    if not login_limiter.allow(f"login:{client_ip}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many sign-in attempts. Try again in a minute.",
            headers={"Retry-After": str(login_limiter.retry_after(f"login:{client_ip}"))},
        )

    email = payload.email.strip().lower()
    user = db.execute(select(User).where(func.lower(User.email) == email)).scalar_one_or_none()

    # Always run a bcrypt comparison so a missing account and a bad password take
    # the same amount of time to reject.
    stored_hash = user.password_hash if user else ""
    password_ok = verify_password(payload.password, stored_hash) if user else False
    if user is None or not password_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)

    token, expires_at = create_access_token(user.id)
    return LoginResponse(access_token=token, expires_at=expires_at, user=user_out(user))


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)) -> UserOut:
    return user_out(current_user)
