"""Test fixtures. Runs against the configured Postgres but inside an isolated schema `fitcoach_test`
so the real `public` data is never touched. External APIs (ExerciseDB, Gemini) are mocked."""
import os
import uuid

os.environ["DB_SCHEMA"] = "fitcoach_test"
os.environ.setdefault("EDB_KEY", "test-key")
os.environ.setdefault("GEMINI_API_KEY", "test-key")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import db  # noqa: E402
from config import get_settings  # noqa: E402

SCHEMA = get_settings().db_schema


@pytest.fixture(scope="session")
def app_client():
    import main
    # the pool's `configure` hook sets search_path, but the schema has to exist first
    db.init_pool()
    with db.get_conn() as conn:
        conn.execute(f'DROP SCHEMA IF EXISTS "{SCHEMA}" CASCADE')
        conn.execute(f'CREATE SCHEMA "{SCHEMA}"')
    db.close_pool()
    with TestClient(main.app) as client:  # runs lifespan: pool + apply_schema()
        yield client
    db.init_pool()
    with db.get_conn() as conn:
        conn.execute(f'DROP SCHEMA IF EXISTS "{SCHEMA}" CASCADE')
    db.close_pool()


@pytest.fixture
def client(app_client):
    return app_client


def make_user(client, prefix="u"):
    name = f"{prefix}_{uuid.uuid4().hex[:8]}"
    r = client.post("/auth/register", json={"username": name, "password": "password123", "email": f"{name}@t.io"})
    assert r.status_code == 201, r.text
    body = r.json()
    return {"username": name, "token": body["access_token"], "id": body["user"]["id"],
            "headers": {"Authorization": f"Bearer {body['access_token']}"}}


@pytest.fixture
def user(client):
    return make_user(client)


@pytest.fixture
def other_user(client):
    return make_user(client, "o")


BENCH = {"exerciseId": "exr_bench", "name": "Bench Press", "imageUrl": "https://img/bench.jpg",
         "bodyParts": ["CHEST"], "equipments": ["BARBELL"], "targetMuscles": ["PECTORALIS MAJOR STERNAL HEAD"],
         "secondaryMuscles": ["TRICEPS BRACHII"], "exerciseType": "STRENGTH", "instructions": ["Press."]}
SQUAT = {"exerciseId": "exr_squat", "name": "Squat", "bodyParts": ["THIGHS"], "equipments": ["BARBELL"],
         "targetMuscles": ["QUADRICEPS", "GLUTEUS MAXIMUS"]}


@pytest.fixture
def bench():
    return BENCH


@pytest.fixture
def squat():
    return SQUAT
