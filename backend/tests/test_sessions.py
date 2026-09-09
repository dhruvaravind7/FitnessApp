from datetime import date, timedelta


def test_session_lifecycle(client, user, bench, squat):
    h = user["headers"]
    assert client.get("/sessions/active", headers=h).json() is None

    r = client.post("/sessions", json={"name": "Push day"}, headers=h)
    assert r.status_code == 201
    sid = r.json()["id"]
    assert r.json()["ended_at"] is None

    # only one active session
    assert client.post("/sessions", json={}, headers=h).status_code == 409

    r = client.post(f"/sessions/{sid}/exercises", headers=h,
                    json={"exerciseDetails": bench, "sets": 3, "reps": 8, "weight": 135, "notes": "ok"})
    assert r.status_code == 201
    eid = r.json()["id"]
    assert r.json()["weight"] == 135.0 and r.json()["image_url"] == "https://img/bench.jpg"

    r = client.post(f"/sessions/{sid}/exercises", headers=h, json={"exerciseDetails": squat, "sets": 5, "reps": 5})
    assert r.status_code == 201 and r.json()["weight"] is None

    active = client.get("/sessions/active", headers=h).json()
    assert active["id"] == sid and active["exercise_count"] == 2 and active["total_volume"] == 3 * 8 * 135

    r = client.patch(f"/sessions/{sid}/exercises/{eid}", json={"reps": 10, "weight": 140.5}, headers=h)
    assert r.status_code == 200 and r.json()["reps"] == 10 and r.json()["weight"] == 140.5
    r = client.patch(f"/sessions/{sid}/exercises/{eid}", json={"clear_weight": True}, headers=h)
    assert r.json()["weight"] is None
    client.patch(f"/sessions/{sid}/exercises/{eid}", json={"weight": 140}, headers=h)

    r = client.patch(f"/sessions/{sid}", json={"finished": True, "name": "Push day A"}, headers=h)
    assert r.status_code == 200 and r.json()["ended_at"] is not None and r.json()["name"] == "Push day A"
    assert client.get("/sessions/active", headers=h).json() is None

    # re-date the session and its exercises follow
    new_date = (date.today() - timedelta(days=3)).isoformat()
    r = client.patch(f"/sessions/{sid}", json={"date": new_date}, headers=h)
    assert r.json()["date"] == new_date and all(e["date"] == new_date for e in r.json()["exercises"])

    r = client.get("/sessions", headers=h)
    assert [s["id"] for s in r.json()] == [sid]
    r = client.get("/sessions", headers=h, params={"from": date.today().isoformat()})
    assert r.json() == []

    assert client.delete(f"/sessions/{sid}/exercises/{eid}", headers=h).status_code == 204
    assert client.get(f"/sessions/{sid}", headers=h).json()["exercise_count"] == 1
    assert client.delete(f"/sessions/{sid}", headers=h).status_code == 204
    assert client.get(f"/sessions/{sid}", headers=h).status_code == 404


def test_quick_log_creates_finished_session(client, user, bench):
    h = user["headers"]
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    r = client.post("/sessions/quick-log", headers=h,
                    json={"exerciseDetails": bench, "sets": 4, "reps": 6, "weight": 185, "date": yesterday})
    assert r.status_code == 201
    s = r.json()
    assert s["ended_at"] is not None and s["date"] == yesterday and s["name"] == "Bench Press"
    assert s["exercises"][0]["date"] == yesterday and s["total_volume"] == 4 * 6 * 185
    assert client.get("/sessions/active", headers=h).json() is None


def test_validation_errors(client, user, bench):
    h = user["headers"]
    sid = client.post("/sessions", json={}, headers=h).json()["id"]
    assert client.post(f"/sessions/{sid}/exercises", headers=h,
                       json={"exerciseDetails": bench, "sets": 0, "reps": 8}).status_code == 422
    assert client.post(f"/sessions/{sid}/exercises", headers=h,
                       json={"exerciseDetails": {"name": "no id"}, "sets": 1, "reps": 1}).status_code == 422
    assert client.post(f"/sessions/{sid}/exercises", headers=h,
                       json={"exerciseDetails": bench, "sets": 1, "reps": 1, "weight": -5}).status_code == 422


def test_users_are_isolated(client, user, other_user, bench):
    sid = client.post("/sessions", json={"name": "mine"}, headers=user["headers"]).json()["id"]
    client.post(f"/sessions/{sid}/exercises", headers=user["headers"],
                json={"exerciseDetails": bench, "sets": 1, "reps": 1})
    oh = other_user["headers"]
    assert client.get(f"/sessions/{sid}", headers=oh).status_code == 404
    assert client.patch(f"/sessions/{sid}", json={"name": "hacked"}, headers=oh).status_code == 404
    assert client.delete(f"/sessions/{sid}", headers=oh).status_code == 404
    assert client.post(f"/sessions/{sid}/exercises", headers=oh,
                       json={"exerciseDetails": bench, "sets": 1, "reps": 1}).status_code == 404
    assert client.get("/sessions", headers=oh).json() == []
    assert client.get(f"/sessions/{sid}", headers=user["headers"]).json()["name"] == "mine"
