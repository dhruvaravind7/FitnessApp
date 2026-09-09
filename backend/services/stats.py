"""Aggregate statistics over a user's workouts. Volume = sets * reps * weight(lbs)."""
from datetime import date as Date, timedelta

from db import get_conn

VOLUME = "w.sets * w.reps * COALESCE(w.weight, 0)"


def _f(v) -> float:
    return float(v or 0)


def _today(conn, today: Date | None) -> Date:
    return today or conn.execute("SELECT CURRENT_DATE AS d").fetchone()["d"]


def current_streak(dates: list[Date], today: Date) -> int:
    """Consecutive training days ending today or yesterday."""
    s = set(dates)
    if today in s:
        d = today
    elif today - timedelta(days=1) in s:
        d = today - timedelta(days=1)
    else:
        return 0
    n = 0
    while d in s:
        n += 1
        d -= timedelta(days=1)
    return n


def overview(user_id: int, today: Date | None = None) -> dict:
    with get_conn() as conn:
        today = _today(conn, today)
        week_start = today - timedelta(days=today.weekday())  # Monday
        month_start = today.replace(day=1)
        totals = conn.execute(
            f"""SELECT COUNT(DISTINCT s.id) AS total_sessions,
                       COUNT(DISTINCT s.id) FILTER (WHERE s.date >= %s) AS sessions_this_week,
                       COUNT(DISTINCT s.id) FILTER (WHERE s.date >= %s) AS sessions_this_month,
                       COALESCE(SUM({VOLUME}) FILTER (WHERE w.date >= %s), 0) AS volume_this_week,
                       COALESCE(SUM({VOLUME}) FILTER (WHERE w.date >= %s), 0) AS volume_this_month,
                       COALESCE(SUM({VOLUME}), 0) AS volume_all_time,
                       COUNT(w.id) AS total_entries
                FROM workout_sessions s LEFT JOIN workouts w ON w.session_id = s.id
                WHERE s.user_id = %s AND s.ended_at IS NOT NULL""",
            (week_start, month_start, week_start, month_start, user_id)).fetchone()
        dates = [r["date"] for r in conn.execute(
            "SELECT DISTINCT date FROM workout_sessions WHERE user_id = %s AND ended_at IS NOT NULL "
            "AND date >= %s ORDER BY date DESC", (user_id, today - timedelta(days=400))).fetchall()]
        last = conn.execute(
            f"""SELECT s.id, s.name, s.date, COUNT(w.id) AS exercise_count, COALESCE(SUM({VOLUME}),0) AS total_volume
                FROM workout_sessions s LEFT JOIN workouts w ON w.session_id = s.id
                WHERE s.user_id = %s AND s.ended_at IS NOT NULL GROUP BY s.id ORDER BY s.date DESC, s.started_at DESC LIMIT 1""",
            (user_id,)).fetchone()
        # weekly volume for the last 8 weeks (Monday-based buckets)
        first_week = week_start - timedelta(weeks=7)
        weekly_rows = conn.execute(
            f"""SELECT (w.date - ((EXTRACT(ISODOW FROM w.date)::int - 1)))::date AS week_start,
                       COALESCE(SUM({VOLUME}),0) AS volume, COUNT(DISTINCT w.session_id) AS sessions, COUNT(w.id) AS entries
                FROM workouts w JOIN workout_sessions s ON s.id = w.session_id
                WHERE w.user_id = %s AND s.ended_at IS NOT NULL AND w.date >= %s GROUP BY 1 ORDER BY 1""",
            (user_id, first_week)).fetchall()
    weekly_map = {r["week_start"]: r for r in weekly_rows}
    weekly = []
    for i in range(8):
        ws = first_week + timedelta(weeks=i)
        r = weekly_map.get(ws)
        weekly.append({"week_start": ws.isoformat(), "volume": _f(r["volume"]) if r else 0.0,
                       "sessions": int(r["sessions"]) if r else 0, "entries": int(r["entries"]) if r else 0})
    return {
        "today": today.isoformat(),
        "total_sessions": int(totals["total_sessions"]),
        "total_entries": int(totals["total_entries"]),
        "sessions_this_week": int(totals["sessions_this_week"]),
        "sessions_this_month": int(totals["sessions_this_month"]),
        "volume_this_week": _f(totals["volume_this_week"]),
        "volume_this_month": _f(totals["volume_this_month"]),
        "volume_all_time": _f(totals["volume_all_time"]),
        "current_streak": current_streak(dates, today),
        "training_days_last_30": sum(1 for d in dates if d > today - timedelta(days=30)),
        "last_session": ({"id": last["id"], "name": last["name"], "date": last["date"].isoformat(),
                          "exercise_count": int(last["exercise_count"]), "total_volume": _f(last["total_volume"])}
                         if last else None),
        "weekly_volume": weekly,
    }


def muscle_breakdown(user_id: int, days: int = 30, today: Date | None = None) -> dict:
    with get_conn() as conn:
        today = _today(conn, today)
        since = today - timedelta(days=days)
        muscles = conn.execute(
            f"""SELECT m AS name, COUNT(*) AS entries, SUM(w.sets) AS sets, COALESCE(SUM({VOLUME}),0) AS volume
                FROM workouts w, UNNEST(w.target_muscles) AS m
                WHERE w.user_id = %s AND w.date > %s GROUP BY m ORDER BY sets DESC, volume DESC""",
            (user_id, since)).fetchall()
        parts = conn.execute(
            f"""SELECT p AS name, COUNT(*) AS entries, SUM(w.sets) AS sets, COALESCE(SUM({VOLUME}),0) AS volume
                FROM workouts w, UNNEST(w.body_parts) AS p
                WHERE w.user_id = %s AND w.date > %s GROUP BY p ORDER BY sets DESC, volume DESC""",
            (user_id, since)).fetchall()
    fmt = lambda rows: [{"name": r["name"], "entries": int(r["entries"]), "sets": int(r["sets"] or 0),
                         "volume": _f(r["volume"])} for r in rows]
    return {"days": days, "since": since.isoformat(), "target_muscles": fmt(muscles), "body_parts": fmt(parts)}


def exercise_progress(user_id: int, exercise_id: str) -> dict:
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT w.date, MAX(w.weight) AS max_weight, COALESCE(SUM({VOLUME}),0) AS volume,
                       SUM(w.sets) AS sets, MAX(w.reps) AS max_reps,
                       MAX(COALESCE(w.weight,0) * (1 + w.reps / 30.0)) AS est_1rm,
                       MIN(w.exercise_name) AS exercise_name
                FROM workouts w WHERE w.user_id = %s AND w.exercise_id = %s GROUP BY w.date ORDER BY w.date""",
            (user_id, exercise_id)).fetchall()
    points = [{"date": r["date"].isoformat(), "max_weight": _f(r["max_weight"]) if r["max_weight"] is not None else None,
               "volume": _f(r["volume"]), "sets": int(r["sets"] or 0), "max_reps": int(r["max_reps"] or 0),
               "est_1rm": round(_f(r["est_1rm"]), 1)} for r in rows]
    best_w = max((p["max_weight"] or 0) for p in points) if points else 0
    return {"exercise_id": exercise_id, "exercise_name": rows[0]["exercise_name"] if rows else None,
            "points": points, "sessions": len(points),
            "best_weight": best_w or None, "best_est_1rm": max((p["est_1rm"] for p in points), default=0) or None}


def recent_exercises(user_id: int, limit: int = 8) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT DISTINCT ON (w.exercise_id) w.exercise_id, w.exercise_name, w.exercise_data->>'imageUrl' AS image_url,
                      w.date, w.sets, w.reps, w.weight, w.target_muscles
               FROM workouts w WHERE w.user_id = %s ORDER BY w.exercise_id, w.date DESC, w.created_at DESC""",
            (user_id,)).fetchall()
    rows = sorted(rows, key=lambda r: r["date"], reverse=True)[:limit]
    return [{**r, "date": r["date"].isoformat(), "weight": _f(r["weight"]) if r["weight"] is not None else None}
            for r in rows]


def personal_records(user_id: int, limit: int = 50) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            f"""WITH ranked AS (
                    SELECT w.exercise_id, w.exercise_name, w.weight, w.reps, w.sets, w.date, {VOLUME} AS volume,
                           ROW_NUMBER() OVER (PARTITION BY w.exercise_id ORDER BY w.weight DESC NULLS LAST, w.reps DESC, w.date DESC) AS rn
                    FROM workouts w WHERE w.user_id = %s)
                SELECT r.exercise_id, r.exercise_name, r.weight AS best_weight, r.reps AS best_weight_reps, r.date AS best_weight_date,
                       (SELECT MAX({VOLUME}) FROM workouts w WHERE w.user_id = %s AND w.exercise_id = r.exercise_id) AS best_volume,
                       (SELECT COUNT(*) FROM workouts w WHERE w.user_id = %s AND w.exercise_id = r.exercise_id) AS times_logged
                FROM ranked r WHERE r.rn = 1 ORDER BY times_logged DESC, r.exercise_name LIMIT %s""",
            (user_id, user_id, user_id, limit)).fetchall()
    return [{"exercise_id": r["exercise_id"], "exercise_name": r["exercise_name"],
             "best_weight": _f(r["best_weight"]) if r["best_weight"] is not None else None,
             "best_weight_reps": int(r["best_weight_reps"]), "best_weight_date": r["best_weight_date"].isoformat(),
             "best_volume": _f(r["best_volume"]), "times_logged": int(r["times_logged"])} for r in rows]
