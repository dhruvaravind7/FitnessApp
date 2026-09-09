"""FitCoach MCP server.

Exposes a user's training data as MCP tools. The current user is taken from a ContextVar so no tool
ever accepts a user id: the in-process coach sets it per request, and the /mcp HTTP endpoint sets it
from the bearer JWT (see main.py). Both share this single FastMCP instance.
"""
import json
from contextvars import ContextVar
from datetime import date as Date, datetime, timedelta
from typing import Any

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from services import exercisedb, stats, workouts

current_user_id: ContextVar[int | None] = ContextVar("current_user_id", default=None)
# The client's local date (set per request); falls back to the server's local date.
current_today: ContextVar[Date | None] = ContextVar("current_today", default=None)


def _today() -> Date:
    return current_today.get() or datetime.now().astimezone().date()

mcp = FastMCP(
    "FitCoach",
    instructions="Tools for reading the authenticated user's workout history, sessions, records and stats, "
                 "and for searching the exercise database. All weights are in pounds (lbs).",
    stateless_http=True,
    json_response=True,
    # Access is already gated by the bearer JWT in main.MCPEndpoint; the SDK's Host-header allowlist
    # would otherwise reject any host other than localhost (LAN IPs, test clients, deployments).
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


def _uid() -> int:
    uid = current_user_id.get()
    if uid is None:
        raise ValueError("Not authenticated: no user bound to this MCP session")
    return uid


def _json(obj: Any) -> str:
    return json.dumps(obj, default=str, separators=(",", ":"))


def _compact_entry(e: dict) -> dict:
    out = {"id": e["id"], "exercise": e["exercise_name"], "exercise_id": e["exercise_id"], "sets": e["sets"],
           "reps": e["reps"], "weight_lbs": e["weight"], "muscles": e.get("target_muscles") or []}
    if e.get("notes"):
        out["notes"] = e["notes"]
    return out


def _compact_session(s: dict) -> dict:
    return {"id": s["id"], "name": s["name"], "date": str(s["date"]), "finished": s["ended_at"] is not None,
            "exercise_count": s.get("exercise_count", 0), "total_volume_lbs": round(s.get("total_volume", 0), 1),
            "notes": s.get("notes"), "exercises": [_compact_entry(e) for e in s.get("exercises", [])]}


@mcp.tool()
def get_today() -> str:
    """Return today's date (ISO) and weekday so relative phrases like 'this week' can be resolved."""
    today = _today()
    return _json({"today": today.isoformat(), "weekday": today.strftime("%A"),
                  "week_start_monday": (today - timedelta(days=today.weekday())).isoformat()})


@mcp.tool()
def get_recent_sessions(days: int = 30, limit: int = 20) -> str:
    """List the user's finished workout sessions from the last `days` days (newest first), each with its exercises,
    sets, reps and weight in lbs. Use this to see what the user has actually trained recently."""
    days = max(1, min(days, 365)); limit = max(1, min(limit, 100))
    since = _today() - timedelta(days=days)
    sessions = workouts.list_sessions(_uid(), date_from=since, limit=limit)
    sessions = [s for s in sessions if s["ended_at"] is not None]
    return _json({"since": since.isoformat(), "count": len(sessions), "sessions": [_compact_session(s) for s in sessions]})


@mcp.tool()
def get_session(session_id: int) -> str:
    """Get one workout session by id with all of its exercises."""
    return _json(_compact_session(workouts.get_session(_uid(), session_id)))


@mcp.tool()
def get_active_session() -> str:
    """Return the session the user is currently in the middle of (not finished), or null if none."""
    s = workouts.get_active_session(_uid())
    return _json(_compact_session(s) if s else None)


@mcp.tool()
def get_exercise_history(exercise_name: str, limit: int = 20) -> str:
    """Past entries for exercises whose name contains `exercise_name` (case-insensitive), newest first.
    Shows how sets/reps/weight changed over time for that movement."""
    limit = max(1, min(limit, 100))
    rows = workouts.exercise_history(_uid(), exercise_name=exercise_name, limit=limit)
    return _json({"query": exercise_name, "count": len(rows),
                  "entries": [{**_compact_entry(r), "date": str(r["date"]), "session": r.get("session_name")} for r in rows]})


@mcp.tool()
def get_exercise_progress(exercise_name: str) -> str:
    """Per-date progression (max weight, estimated 1RM, volume) for the exercise best matching `exercise_name`."""
    rows = workouts.exercise_history(_uid(), exercise_name=exercise_name, limit=1)
    if not rows:
        return _json({"query": exercise_name, "found": False})
    return _json({"found": True, **stats.exercise_progress(_uid(), rows[0]["exercise_id"])})


@mcp.tool()
def get_personal_records() -> str:
    """Best weight (with reps and date), best single-entry volume and how often each exercise was logged."""
    return _json({"records": stats.personal_records(_uid())})


@mcp.tool()
def get_weekly_summary(weeks: int = 4) -> str:
    """Training overview: sessions this week/month, volume, streak, last session and per-week volume for the
    last `weeks` weeks (max 8)."""
    weeks = max(1, min(weeks, 8))
    o = stats.overview(_uid(), today=_today())
    o["weekly_volume"] = o["weekly_volume"][-weeks:]
    return _json(o)


@mcp.tool()
def get_muscle_group_breakdown(days: int = 30) -> str:
    """Sets and volume per target muscle and per body part over the last `days` days. Use it to spot
    imbalances or neglected muscle groups."""
    return _json(stats.muscle_breakdown(_uid(), days=max(1, min(days, 365)), today=_today()))


@mcp.tool()
def search_exercises(query: str = "", body_part: str = "", equipment: str = "", target_muscle: str = "",
                     exercise_type: str = "", limit: int = 10) -> str:
    """Search the exercise database. Either give a free-text `query` (name search) or filters
    (body_part e.g. CHEST/BACK/THIGHS, equipment e.g. DUMBBELL/BARBELL/BODY WEIGHT, target_muscle,
    exercise_type STRENGTH/CARDIO/STRETCHING). Returns exercise ids and names the user can look up in the app."""
    _uid()
    limit = max(1, min(limit, 25))
    if query.strip():
        data = exercisedb.search_by_name(query)[:limit]
    else:
        data = exercisedb.list_exercises(body_part=body_part, equipment=equipment, target_muscle=target_muscle,
                                         exercise_type=exercise_type, limit=limit)["data"]
    return _json([{"exercise_id": d["exerciseId"], "name": d["name"], "body_parts": d["bodyParts"],
                   "equipment": d["equipments"], "target_muscles": d["targetMuscles"]} for d in data])
