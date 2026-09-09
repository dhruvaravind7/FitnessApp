"""Pydantic request/response models."""
from datetime import date as Date, datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---- auth ----
class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=200)
    email: EmailStr

    @field_validator("username")
    @classmethod
    def strip_username(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("username is required")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str | None = None
    created_at: datetime | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    user: UserOut


# ---- sessions / workouts ----
class ExerciseEntryIn(BaseModel):
    """One exercise performed inside a session. Weight is always in lbs."""
    exerciseDetails: dict[str, Any]
    sets: int = Field(ge=1, le=100)
    reps: int = Field(ge=1, le=1000)
    weight: float | None = Field(default=None, ge=0, le=9999)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("exerciseDetails")
    @classmethod
    def require_core_fields(cls, v: dict) -> dict:
        for key in ("exerciseId", "name"):
            if not v.get(key):
                raise ValueError(f"exerciseDetails.{key} is required")
        return v


class ExerciseEntryUpdate(BaseModel):
    sets: int | None = Field(default=None, ge=1, le=100)
    reps: int | None = Field(default=None, ge=1, le=1000)
    weight: float | None = Field(default=None, ge=0, le=9999)
    clear_weight: bool = False  # weight=None is ambiguous with "not provided"
    notes: str | None = Field(default=None, max_length=2000)


class ExerciseEntryOut(BaseModel):
    id: int
    session_id: int
    exercise_id: str
    exercise_name: str
    target_muscles: list[str]
    body_parts: list[str]
    image_url: str | None = None
    sets: int
    reps: int
    weight: float | None
    notes: str | None
    date: Date
    created_at: datetime | None = None


class SessionCreate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    date: Date | None = None
    notes: str | None = Field(default=None, max_length=2000)


class SessionUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    date: Date | None = None
    notes: str | None = Field(default=None, max_length=2000)
    finished: bool | None = None


class QuickLogRequest(ExerciseEntryIn):
    date: Date | None = None
    session_name: str | None = Field(default=None, max_length=120)


class SessionOut(BaseModel):
    id: int
    name: str | None
    date: Date
    started_at: datetime
    ended_at: datetime | None
    notes: str | None
    exercise_count: int = 0
    total_volume: float = 0
    exercises: list[ExerciseEntryOut] = []


# ---- coach ----
class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=120)


class ConversationOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
    today: Date | None = None  # client's local date so "today"/"this week" resolve in the user's timezone


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    role: str
    content: str
    created_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut] = []


class ChatResponse(BaseModel):
    user_message: MessageOut
    model_message: MessageOut
    conversation: ConversationOut
