from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import create_access_token, decode_token, hash_password, verify_password
from ..database import get_db
from ..models import User
from ..schemas import LoginIn, RegisterIn, TokenOut, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_NAME = "zoomly_token"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


def _set_token_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,  # set True in production with HTTPS
    )


def get_current_user(
    zoomly_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    """Return the logged-in user from the JWT cookie, or None."""
    if not zoomly_token:
        return None
    payload = decode_token(zoomly_token)
    if not payload:
        return None
    user = db.scalar(select(User).where(User.id == int(payload["sub"])))
    return user


def require_user(user: User | None = Depends(get_current_user)) -> User:
    """Like get_current_user but raises 401 if not authenticated."""
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, response: Response, db: Session = Depends(get_db)):
    if db.scalar(select(User.id).where(User.email == payload.email.lower())):
        raise HTTPException(status_code=400, detail="An account with that email already exists")
    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, user.email)
    _set_token_cookie(response, token)
    return {"access_token": token, "user": UserOut.model_validate(user)}


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_access_token(user.id, user.email)
    _set_token_cookie(response, token)
    return {"access_token": token, "user": UserOut.model_validate(user)}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"status": "logged out"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(require_user)):
    return UserOut.model_validate(user)
