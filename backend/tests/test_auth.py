import uuid


def test_register_login_me(client):
    name = f"a_{uuid.uuid4().hex[:8]}"
    r = client.post("/auth/register", json={"username": name, "password": "password123", "email": f"{name}@t.io"})
    assert r.status_code == 201
    assert r.json()["token_type"] == "Bearer"
    assert r.json()["user"]["username"] == name

    r = client.post("/auth/login", json={"username": name, "password": "password123"})
    assert r.status_code == 200
    token = r.json()["access_token"]

    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200 and r.json()["username"] == name


def test_duplicate_username_and_email(client, user):
    r = client.post("/auth/register", json={"username": user["username"], "password": "password123", "email": "new@t.io"})
    assert r.status_code == 409
    r = client.post("/auth/register", json={"username": "someone_else", "password": "password123",
                                             "email": f"{user['username']}@t.io"})
    assert r.status_code == 409


def test_validation(client):
    r = client.post("/auth/register", json={"username": "ab", "password": "short", "email": "not-an-email"})
    assert r.status_code == 422


def test_bad_credentials(client, user):
    assert client.post("/auth/login", json={"username": user["username"], "password": "nope"}).status_code == 401
    assert client.post("/auth/login", json={"username": "ghost_user", "password": "whatever"}).status_code == 401


def test_bad_or_missing_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer not.a.jwt"}).status_code == 401
    assert client.get("/sessions", headers={"Authorization": "Basic abc"}).status_code == 401
