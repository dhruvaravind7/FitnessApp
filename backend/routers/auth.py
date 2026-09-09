from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from fastapi import APIRouter, Depends, HTTPException, status
from psycopg.errors import UniqueViolation

from db import get_conn
from deps import create_access_token, get_current_user
from models import LoginRequest, RegisterRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
ph = PasswordHasher()


def _user_row(conn, user_id: int) -> dict | None:
    return conn.execute("SELECT id, username, email, created_at FROM users WHERE id = %s", (user_id,)).fetchone()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest):
    with get_conn() as conn:
        if conn.execute("SELECT 1 FROM users WHERE username = %s", (body.username,)).fetchone():
            raise HTTPException(status_code=409, detail="Username already exists. Please choose another one")
        if conn.execute("SELECT 1 FROM users WHERE email = %s", (body.email,)).fetchone():
            raise HTTPException(status_code=409, detail="Email is already registered. Please use another one")
        try:
            row = conn.execute(
                "INSERT INTO users (username, password, email) VALUES (%s, %s, %s) RETURNING id, username, email, created_at",
                (body.username, ph.hash(body.password), body.email),
            ).fetchone()
        except UniqueViolation:
            raise HTTPException(status_code=409, detail="Username or email already exists")
    token = create_access_token(row["id"], row["username"])
    return TokenResponse(access_token=token, user=UserOut(**row))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, username, email, created_at, password FROM users WHERE username = %s", (body.username.strip(),)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    try:
        ph.verify(row["password"], body.password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    if ph.check_needs_rehash(row["password"]):
        with get_conn() as conn:
            conn.execute("UPDATE users SET password = %s WHERE id = %s", (ph.hash(body.password), row["id"]))
    token = create_access_token(row["id"], row["username"])
    return TokenResponse(access_token=token, user=UserOut(id=row["id"], username=row["username"],
                                                          email=row["email"], created_at=row["created_at"]))


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        row = _user_row(conn, user["id"])
    if row is None:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return UserOut(**row)
