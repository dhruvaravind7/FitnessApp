"""Coach persistence + MCP tool scoping. Gemini is replaced by a fake that still exercises the real
in-process MCP session, so the tools run under the request's user context."""
import json

import pytest
from mcp.shared.memory import create_connected_server_and_client_session

import services.coach as coach_service
from mcp_server import current_user_id, mcp


async def fake_generate_reply(user_id: int, history: list[dict]) -> str:
    token = current_user_id.set(user_id)
    try:
        async with create_connected_server_and_client_session(mcp) as session:
            tools = await session.list_tools()
            assert {t.name for t in tools.tools} >= {"get_recent_sessions", "get_personal_records", "get_weekly_summary",
                                                     "get_exercise_history", "get_muscle_group_breakdown", "search_exercises"}
            res = await session.call_tool("get_recent_sessions", {"days": 30})
            data = json.loads(res.content[0].text)
            return f"You logged {data['count']} session(s): " + ", ".join(s["name"] for s in data["sessions"])
    finally:
        current_user_id.reset(token)


@pytest.fixture
def fake_gemini(monkeypatch):
    monkeypatch.setattr(coach_service, "generate_reply", fake_generate_reply)


def test_conversation_flow_and_scoping(client, user, other_user, bench, fake_gemini):
    h = user["headers"]
    client.post("/sessions/quick-log", headers=h, json={"exerciseDetails": bench, "sets": 3, "reps": 8, "weight": 100,
                                                        "session_name": "Chest A"})
    client.post("/sessions/quick-log", headers=other_user["headers"],
                json={"exerciseDetails": bench, "sets": 1, "reps": 1, "session_name": "OTHER USERS SESSION"})

    r = client.post("/coach/conversations", headers=h, json={})
    assert r.status_code == 201
    cid = r.json()["id"]
    assert r.json()["title"] == "New conversation"

    r = client.post(f"/coach/conversations/{cid}/messages", headers=h, json={"content": "What have I done lately?"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user_message"]["role"] == "user" and body["model_message"]["role"] == "model"
    assert body["model_message"]["content"] == "You logged 1 session(s): Chest A"
    assert "OTHER USERS" not in body["model_message"]["content"]
    assert body["conversation"]["title"].startswith("What have I done")

    conv = client.get(f"/coach/conversations/{cid}", headers=h).json()
    assert [m["role"] for m in conv["messages"]] == ["user", "model"] and conv["message_count"] == 2

    assert client.get(f"/coach/conversations/{cid}", headers=other_user["headers"]).status_code == 404
    assert client.get("/coach/conversations", headers=other_user["headers"]).json() == []
    assert client.delete(f"/coach/conversations/{cid}", headers=other_user["headers"]).status_code == 404
    assert client.delete(f"/coach/conversations/{cid}", headers=h).status_code == 204
    assert client.get("/coach/conversations", headers=h).json() == []


def test_mcp_http_endpoint_requires_auth_and_scopes_tools(client, user, other_user, bench):
    client.post("/sessions/quick-log", headers=user["headers"],
                json={"exerciseDetails": bench, "sets": 2, "reps": 10, "weight": 50, "session_name": "Mine"})
    mcp_headers = {**user["headers"], "content-type": "application/json", "accept": "application/json, text/event-stream"}

    assert client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"}).status_code == 401
    assert client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
                       headers={**mcp_headers, "Authorization": "Bearer bad"}).status_code == 401

    r = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}, headers=mcp_headers)
    assert r.status_code == 200, r.text
    assert "get_personal_records" in {t["name"] for t in r.json()["result"]["tools"]}

    r = client.post("/mcp", headers=mcp_headers, json={"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                                                        "params": {"name": "get_personal_records", "arguments": {}}})
    recs = json.loads(r.json()["result"]["content"][0]["text"])["records"]
    assert [x["exercise_name"] for x in recs] == ["Bench Press"] and recs[0]["best_weight"] == 50

    r = client.post("/mcp", headers={**mcp_headers, **other_user["headers"]},
                    json={"jsonrpc": "2.0", "id": 3, "method": "tools/call",
                          "params": {"name": "get_personal_records", "arguments": {}}})
    assert json.loads(r.json()["result"]["content"][0]["text"])["records"] == []
