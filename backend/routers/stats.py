from datetime import date as Date

from fastapi import APIRouter, Depends, Query

from deps import get_current_user
from services import stats

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/overview")
def overview(user: dict = Depends(get_current_user), today: Date | None = None):
    """`today` lets the client pass its local date so week/streak math matches the user's timezone."""
    return stats.overview(user["id"], today=today)


@router.get("/muscles")
def muscles(user: dict = Depends(get_current_user), days: int = Query(default=30, ge=1, le=365), today: Date | None = None):
    return stats.muscle_breakdown(user["id"], days=days, today=today)


@router.get("/records")
def records(user: dict = Depends(get_current_user)):
    return stats.personal_records(user["id"])


@router.get("/recent-exercises")
def recent(user: dict = Depends(get_current_user), limit: int = Query(default=8, ge=1, le=50)):
    return stats.recent_exercises(user["id"], limit=limit)


@router.get("/exercises/{exercise_id}/progress")
def progress(exercise_id: str, user: dict = Depends(get_current_user)):
    return stats.exercise_progress(user["id"], exercise_id)
