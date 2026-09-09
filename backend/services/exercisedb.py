"""Thin client for the ExerciseDB RapidAPI ("EDB with videos and images by ascendapi").

Observed behaviour of the upstream API (probed 2026-09):
- /exercises/search?search=  -> fixed 10 results, each only {exerciseId, name, imageUrl}
- /exercises?bodyParts&equipments&targetMuscles&exerciseType&limit&after
    -> full objects; filters are case-insensitive and combine with AND; max 25 per page;
       pagination is cursor based via `after=<meta.nextCursor>` (offset is ignored)
- /exercises/{id}  -> full object incl. videoUrl, instructions, overview, exerciseTips
"""
from typing import Any

import httpx
from fastapi import HTTPException

from config import get_settings

BASE_URL = "https://edb-with-videos-and-images-by-ascendapi.p.rapidapi.com/api/v1"
TIMEOUT = httpx.Timeout(10.0, connect=5.0)
MAX_PAGE = 25

# Static filter vocab (mirrors /bodyparts, /equipments, /muscles, /exercisetypes upstream).
BODY_PARTS = ["BACK", "CALVES", "CHEST", "FOREARMS", "HIPS", "NECK", "SHOULDERS", "THIGHS", "WAIST", "HANDS",
              "FEET", "FACE", "FULL BODY", "BICEPS", "UPPER ARMS", "TRICEPS", "HAMSTRINGS", "QUADRICEPS"]
EQUIPMENTS = ["ASSISTED", "BAND", "BARBELL", "BATTLING ROPE", "BODY WEIGHT", "BOSU BALL", "CABLE", "DUMBBELL",
              "EZ BARBELL", "HAMMER", "KETTLEBELL", "LEVERAGE MACHINE", "MEDICINE BALL", "OLYMPIC BARBELL",
              "POWER SLED", "RESISTANCE BAND", "ROLL", "ROLLBALL", "ROPE", "SLED MACHINE", "SMITH MACHINE",
              "STABILITY BALL", "STICK", "SUSPENSION", "TRAP BAR", "VIBRATE PLATE", "WEIGHTED", "WHEEL ROLLER"]
EXERCISE_TYPES = ["STRENGTH", "CARDIO", "PLYOMETRICS", "STRETCHING", "WEIGHTLIFTING", "YOGA", "AEROBIC"]


def _headers() -> dict[str, str]:
    key = get_settings().edb_key
    if not key:
        raise HTTPException(status_code=503, detail="Exercise database is not configured (EDB_KEY missing)")
    return {"Accept": "application/json", "X-RapidAPI-Key": key}


def _get(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    try:
        r = httpx.get(f"{BASE_URL}{path}", headers=_headers(), params=params or {}, timeout=TIMEOUT)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Exercise database unreachable: {exc.__class__.__name__}")
    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="Exercise not found")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Exercise database error ({r.status_code})")
    try:
        body = r.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="Exercise database returned invalid JSON")
    if not isinstance(body, dict) or "data" not in body:
        raise HTTPException(status_code=502, detail="Exercise database returned an unexpected payload")
    return body


def normalize(raw: dict[str, Any]) -> dict[str, Any]:
    """Project an upstream exercise object onto the shape the frontend and DB rely on."""
    return {
        "exerciseId": raw.get("exerciseId"),
        "name": (raw.get("name") or "").strip(),
        "imageUrl": raw.get("imageUrl"),
        "videoUrl": raw.get("videoUrl"),
        "bodyParts": raw.get("bodyParts") or [],
        "equipments": raw.get("equipments") or [],
        "targetMuscles": raw.get("targetMuscles") or [],
        "secondaryMuscles": raw.get("secondaryMuscles") or [],
        "exerciseType": raw.get("exerciseType"),
        "instructions": raw.get("instructions") or [],
        "overview": raw.get("overview"),
        "exerciseTips": raw.get("exerciseTips") or [],
    }


def search_by_name(query: str) -> list[dict[str, Any]]:
    query = query.strip()
    if not query:
        return []
    body = _get("/exercises/search", {"search": query})
    return [normalize(x) for x in body["data"]]


def list_exercises(*, body_part: str = "", equipment: str = "", target_muscle: str = "",
                   exercise_type: str = "", limit: int = MAX_PAGE, after: str | None = None) -> dict[str, Any]:
    params: dict[str, Any] = {"limit": max(1, min(limit, MAX_PAGE))}
    for key, value in (("bodyParts", body_part), ("equipments", equipment),
                       ("targetMuscles", target_muscle), ("exerciseType", exercise_type)):
        if value and value.strip():
            params[key] = value.strip()
    if after:
        params["after"] = after
    body = _get("/exercises", params)
    meta = body.get("meta") or {}
    return {
        "data": [normalize(x) for x in body["data"]],
        "total": meta.get("total"),
        "hasNextPage": bool(meta.get("hasNextPage")),
        "nextCursor": meta.get("nextCursor"),
    }


def get_exercise(exercise_id: str) -> dict[str, Any]:
    body = _get(f"/exercises/{exercise_id}")
    if not body["data"]:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return normalize(body["data"])
