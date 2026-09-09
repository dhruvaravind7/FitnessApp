from datetime import date as Date

from fastapi import APIRouter, Depends, Query, status

from deps import get_current_user
from models import (ExerciseEntryIn, ExerciseEntryOut, ExerciseEntryUpdate, QuickLogRequest, SessionCreate,
                    SessionOut, SessionUpdate)
from services import workouts

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=list[SessionOut])
def list_sessions(user: dict = Depends(get_current_user), date_from: Date | None = Query(default=None, alias="from"),
                  date_to: Date | None = Query(default=None, alias="to"),
                  limit: int = Query(default=50, ge=1, le=200), offset: int = Query(default=0, ge=0)):
    return workouts.list_sessions(user["id"], date_from=date_from, date_to=date_to, limit=limit, offset=offset)


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def start_session(body: SessionCreate, user: dict = Depends(get_current_user)):
    return workouts.create_session(user["id"], name=body.name, date=body.date, notes=body.notes)


@router.post("/quick-log", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def quick_log(body: QuickLogRequest, user: dict = Depends(get_current_user)):
    return workouts.quick_log(user["id"], body)


@router.get("/active", response_model=SessionOut | None)
def active_session(user: dict = Depends(get_current_user)):
    return workouts.get_active_session(user["id"])


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: int, user: dict = Depends(get_current_user)):
    return workouts.get_session(user["id"], session_id)


@router.patch("/{session_id}", response_model=SessionOut)
def update_session(session_id: int, body: SessionUpdate, user: dict = Depends(get_current_user)):
    return workouts.update_session(user["id"], session_id, name=body.name, date=body.date, notes=body.notes,
                                   finished=body.finished)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: int, user: dict = Depends(get_current_user)):
    workouts.delete_session(user["id"], session_id)


@router.post("/{session_id}/exercises", response_model=ExerciseEntryOut, status_code=status.HTTP_201_CREATED)
def add_exercise(session_id: int, body: ExerciseEntryIn, user: dict = Depends(get_current_user)):
    return workouts.add_exercise(user["id"], session_id, body)


@router.patch("/{session_id}/exercises/{entry_id}", response_model=ExerciseEntryOut)
def update_exercise(session_id: int, entry_id: int, body: ExerciseEntryUpdate, user: dict = Depends(get_current_user)):
    return workouts.update_exercise(user["id"], session_id, entry_id, body)


@router.delete("/{session_id}/exercises/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exercise(session_id: int, entry_id: int, user: dict = Depends(get_current_user)):
    workouts.delete_exercise(user["id"], session_id, entry_id)
