from datetime import date, timedelta

from services.stats import current_streak


def log(client, h, ex, d, sets, reps, weight=None):
    r = client.post("/sessions/quick-log", headers=h,
                    json={"exerciseDetails": ex, "sets": sets, "reps": reps, "weight": weight, "date": d.isoformat()})
    assert r.status_code == 201, r.text
    return r.json()


def test_current_streak_math():
    t = date(2026, 9, 8)
    assert current_streak([], t) == 0
    assert current_streak([t], t) == 1
    assert current_streak([t, t - timedelta(1), t - timedelta(2)], t) == 3
    assert current_streak([t - timedelta(1), t - timedelta(2)], t) == 2  # rested today, streak alive
    assert current_streak([t - timedelta(2)], t) == 0


def test_overview_muscles_progress_records(client, user, bench, squat):
    h = user["headers"]
    today = date.today()
    log(client, h, bench, today - timedelta(days=8), 3, 8, 100)   # last week: 2400
    log(client, h, bench, today - timedelta(days=1), 3, 8, 110)   # 2640
    log(client, h, squat, today, 5, 5, 200)                       # 5000
    # an unfinished session must not count
    client.post("/sessions", json={"name": "wip"}, headers=h)

    o = client.get("/stats/overview", headers=h, params={"today": today.isoformat()}).json()
    assert o["total_sessions"] == 3
    assert o["current_streak"] == 2
    assert o["volume_all_time"] == 2400 + 2640 + 5000
    assert o["last_session"]["name"] == "Squat"
    assert len(o["weekly_volume"]) == 8 and sum(w["volume"] for w in o["weekly_volume"]) == o["volume_all_time"]
    assert o["weekly_volume"][-1]["week_start"] == (today - timedelta(days=today.weekday())).isoformat()

    m = client.get("/stats/muscles", headers=h, params={"days": 7, "today": today.isoformat()}).json()
    names = {x["name"]: x for x in m["target_muscles"]}
    assert names["PECTORALIS MAJOR STERNAL HEAD"]["sets"] == 3  # only the entry from yesterday
    assert names["QUADRICEPS"]["volume"] == 5000 and names["GLUTEUS MAXIMUS"]["volume"] == 5000
    assert {x["name"] for x in m["body_parts"]} == {"CHEST", "THIGHS"}

    p = client.get("/stats/exercises/exr_bench/progress", headers=h).json()
    assert p["exercise_name"] == "Bench Press" and len(p["points"]) == 2
    assert p["points"][0]["max_weight"] == 100 and p["points"][1]["max_weight"] == 110
    assert p["best_weight"] == 110 and p["points"][1]["est_1rm"] == round(110 * (1 + 8 / 30), 1)

    recs = {r["exercise_id"]: r for r in client.get("/stats/records", headers=h).json()}
    assert recs["exr_bench"]["best_weight"] == 110 and recs["exr_bench"]["times_logged"] == 2
    assert recs["exr_squat"]["best_volume"] == 5000

    recent = client.get("/stats/recent-exercises", headers=h).json()
    assert [r["exercise_id"] for r in recent] == ["exr_squat", "exr_bench"]


def test_stats_empty_user(client, user):
    o = client.get("/stats/overview", headers=user["headers"]).json()
    assert o["total_sessions"] == 0 and o["current_streak"] == 0 and o["last_session"] is None
    assert client.get("/stats/exercises/none/progress", headers=user["headers"]).json()["points"] == []


def test_progress_keeps_two_sessions_logged_on_the_same_day(client, user, bench):
    """Regression: exercise_progress grouped by date alone, so a second session on the same
    day was folded into the first and only its MAX() weight survived. The coach could then
    only see the heavier entry and reported a single session."""
    h = user["headers"]
    today = date.today()
    log(client, h, bench, today, 3, 10, 125)
    log(client, h, bench, today, 3, 10, 130)

    p = client.get("/stats/exercises/exr_bench/progress", headers=h).json()
    assert len(p["points"]) == 2, "same-day sessions must stay separate points"
    assert p["sessions"] == 2, "`sessions` must count sessions, not distinct dates"
    # Chronological, and the lighter first entry is still visible rather than absorbed.
    assert [pt["max_weight"] for pt in p["points"]] == [125, 130]
    assert [pt["sets"] for pt in p["points"]] == [3, 3]
    assert len({pt["session_id"] for pt in p["points"]}) == 2
    assert p["best_weight"] == 130
