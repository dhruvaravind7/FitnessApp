"""Sessions and exercise entries: all DB access for the workout domain.

Shared by the REST routers and the MCP tools. Every function is scoped by user_id.
Weights are stored and returned in lbs.
"""
import json
from datetime import date as Date
from typing import Any

from fastapi import HTTPException
from psycopg.errors import UniqueViolation

from db import get_conn

SESSION_COLS = "s.id, s.name, s.date, s.started_at, s.ended_at, s.notes"
WORKOUT_COLS = ("w.id, w.session_id, w.exercise_id, w.exercise_name, w.target_muscles, w.body_parts, "
                "w.exercise_data->>'imageUrl' AS image_url, w.sets, w.reps, w.weight, w.notes, w.date, w.created_at")


def _num(v) -> float | None:
    return None if v is None else float(v)


def _entry(row: dict) -> dict:
    row = dict(row)
    row["weight"] = _num(row.get("weight"))
    return row


def volume_of(entry: dict) -> float:
    return float(entry["sets"]) * float(entry["reps"]) * float(entry.get("weight") or 0)


def _attach_exercises(conn, sessions: list[dict]) -> list[dict]:
    sessions = [dict(s) for s in sessions]
    for s in sessions:
        s["exercises"] = []
        s["exercise_count"] = 0
        s["total_volume"] = 0.0
    if not sessions:
        return sessions
    by_id = {s["id"]: s for s in sessions}
    rows = conn.execute(
        f"SELECT {WORKOUT_COLS} FROM workouts w WHERE w.session_id = ANY(%s) ORDER BY w.created_at, w.id",
        (list(by_id.keys()),),
    ).fetchall()
    for r in rows:
        e = _entry(r)
        s = by_id[e["session_id"]]
        s["exercises"].append(e)
        s["exercise_count"] += 1
        s["total_volume"] += volume_of(e)
    return sessions


# ---- sessions ----
def list_sessions(user_id: int, *, date_from: Date | None = None, date_to: Date | None = None,
                  limit: int = 50, offset: int = 0, include_exercises: bool = True) -> list[dict]:
    clauses = ["s.user_id = %s"]
    params: list[Any] = [user_id]
    if date_from:
        clauses.append("s.date >= %s"); params.append(date_from)
    if date_to:
        clauses.append("s.date <= %s"); params.append(date_to)
    params += [limit, offset]
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT {SESSION_COLS} FROM workout_sessions s WHERE {' AND '.join(clauses)} "
            "ORDER BY s.date DESC, s.started_at DESC LIMIT %s OFFSET %s", params).fetchall()
        return _attach_exercises(conn, rows) if include_exercises else [dict(r) for r in rows]


def get_session(user_id: int, session_id: int) -> dict:
    with get_conn() as conn:
        row = conn.execute(f"SELECT {SESSION_COLS} FROM workout_sessions s WHERE s.id = %s AND s.user_id = %s",
                           (session_id, user_id)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Session not found")
        return _attach_exercises(conn, [row])[0]


def get_active_session(user_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(f"SELECT {SESSION_COLS} FROM workout_sessions s WHERE s.user_id = %s AND s.ended_at IS NULL",
                           (user_id,)).fetchone()
        return _attach_exercises(conn, [row])[0] if row else None


def create_session(user_id: int, *, name: str | None = None, date: Date | None = None,
                   notes: str | None = None, finished: bool = False) -> dict:
    with get_conn() as conn:
        try:
            row = conn.execute(
                f"INSERT INTO workout_sessions (user_id, name, date, notes, ended_at) "
                f"VALUES (%s, %s, COALESCE(%s, CURRENT_DATE), %s, CASE WHEN %s THEN NOW() ELSE NULL END) "
                f"RETURNING id, name, date, started_at, ended_at, notes",
                (user_id, (name or "").strip() or None, date, notes, finished)).fetchone()
        except UniqueViolation:
            raise HTTPException(status_code=409, detail="You already have an active session. Finish it first.")
        return _attach_exercises(conn, [row])[0]


def update_session(user_id: int, session_id: int, *, name: str | None = None, date: Date | None = None,
                   notes: str | None = None, finished: bool | None = None) -> dict:
    sets, params = [], []
    if name is not None:
        sets.append("name = %s"); params.append(name.strip() or None)
    if date is not None:
        sets.append("date = %s"); params.append(date)
    if notes is not None:
        sets.append("notes = %s"); params.append(notes)
    if finished is True:
        sets.append("ended_at = COALESCE(ended_at, NOW())")
    elif finished is False:
        sets.append("ended_at = NULL")
    if not sets:
        return get_session(user_id, session_id)
    params += [session_id, user_id]
    with get_conn() as conn:
        try:
            row = conn.execute(f"UPDATE workout_sessions SET {', '.join(sets)} WHERE id = %s AND user_id = %s "
                               "RETURNING id, name, date, started_at, ended_at, notes", params).fetchone()
        except UniqueViolation:
            raise HTTPException(status_code=409, detail="You already have an active session.")
        if row is None:
            raise HTTPException(status_code=404, detail="Session not found")
        if date is not None:
            conn.execute("UPDATE workouts SET date = %s WHERE session_id = %s", (date, session_id))
        return _attach_exercises(conn, [row])[0]


def delete_session(user_id: int, session_id: int) -> None:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM workout_sessions WHERE id = %s AND user_id = %s", (session_id, user_id))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Session not found")


# ---- exercise entries ----
def _slim_exercise(details: dict) -> dict:
    keep = ("exerciseId", "name", "imageUrl", "videoUrl", "bodyParts", "equipments", "targetMuscles",
            "secondaryMuscles", "exerciseType")
    return {k: details.get(k) for k in keep if details.get(k) is not None}


def add_exercise(user_id: int, session_id: int, entry) -> dict:
    """`entry` is an ExerciseEntryIn-like object (exerciseDetails, sets, reps, weight, notes)."""
    details = entry.exerciseDetails
    with get_conn() as conn:
        s = conn.execute("SELECT id, date FROM workout_sessions WHERE id = %s AND user_id = %s",
                         (session_id, user_id)).fetchone()
        if s is None:
            raise HTTPException(status_code=404, detail="Session not found")
        row = conn.execute(
            "INSERT INTO workouts (user_id, session_id, exercise_id, exercise_name, target_muscles, body_parts, "
            "exercise_data, sets, reps, weight, date, notes) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
            "RETURNING id",
            (user_id, session_id, str(details["exerciseId"]), str(details["name"]).strip()[:200],
             list(details.get("targetMuscles") or []), list(details.get("bodyParts") or []),
             json.dumps(_slim_exercise(details)), entry.sets, entry.reps, entry.weight, s["date"], entry.notes),
        ).fetchone()
        return get_exercise_entry(user_id, row["id"], conn)


def get_exercise_entry(user_id: int, entry_id: int, conn=None) -> dict:
    def _run(c):
        r = c.execute(f"SELECT {WORKOUT_COLS} FROM workouts w WHERE w.id = %s AND w.user_id = %s",
                      (entry_id, user_id)).fetchone()
        if r is None:
            raise HTTPException(status_code=404, detail="Exercise entry not found")
        return _entry(r)
    if conn is not None:
        return _run(conn)
    with get_conn() as c:
        return _run(c)


def update_exercise(user_id: int, session_id: int, entry_id: int, upd) -> dict:
    sets, params = [], []
    if upd.sets is not None:
        sets.append("sets = %s"); params.append(upd.sets)
    if upd.reps is not None:
        sets.append("reps = %s"); params.append(upd.reps)
    if upd.clear_weight:
        sets.append("weight = NULL")
    elif upd.weight is not None:
        sets.append("weight = %s"); params.append(upd.weight)
    if upd.notes is not None:
        sets.append("notes = %s"); params.append(upd.notes or None)
    if not sets:
        return get_exercise_entry(user_id, entry_id)
    params += [entry_id, session_id, user_id]
    with get_conn() as conn:
        cur = conn.execute(f"UPDATE workouts SET {', '.join(sets)} WHERE id = %s AND session_id = %s AND user_id = %s",
                           params)
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Exercise entry not found")
        return get_exercise_entry(user_id, entry_id, conn)


def delete_exercise(user_id: int, session_id: int, entry_id: int) -> None:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM workouts WHERE id = %s AND session_id = %s AND user_id = %s",
                           (entry_id, session_id, user_id))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Exercise entry not found")


def quick_log(user_id: int, req) -> dict:
    """Create a finished single-exercise session and return it."""
    name = req.session_name or f"{req.exerciseDetails.get('name', 'Workout')}".strip()
    session = create_session(user_id, name=name, date=req.date, finished=True)
    add_exercise(user_id, session["id"], req)
    return get_session(user_id, session["id"])


# ---- queries used by MCP tools / stats ----
def exercise_history(user_id: int, exercise_name: str = "", exercise_id: str = "", limit: int = 20) -> list[dict]:
    clauses, params = ["w.user_id = %s"], [user_id]
    if exercise_id:
        clauses.append("w.exercise_id = %s"); params.append(exercise_id)
    if exercise_name:
        clauses.append("w.exercise_name ILIKE %s"); params.append(f"%{exercise_name.strip()}%")
    params.append(limit)
    with get_conn() as conn:
        rows = conn.execute(f"SELECT {WORKOUT_COLS}, s.name AS session_name FROM workouts w "
                            f"JOIN workout_sessions s ON s.id = w.session_id WHERE {' AND '.join(clauses)} "
                            "ORDER BY w.date DESC, w.created_at DESC LIMIT %s", params).fetchall()
    return [_entry(r) for r in rows]
