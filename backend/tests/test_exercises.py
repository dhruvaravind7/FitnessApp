import httpx
import respx

from services.exercisedb import BASE_URL


@respx.mock
def test_search_normalizes(client):
    respx.get(f"{BASE_URL}/exercises/search").mock(return_value=httpx.Response(200, json={
        "success": True, "data": [{"exerciseId": "e1", "name": "Bench Press ", "imageUrl": "u"}]}))
    r = client.get("/exercises/search", params={"q": "bench"})
    assert r.status_code == 200
    assert r.json() == [{"exerciseId": "e1", "name": "Bench Press", "imageUrl": "u", "videoUrl": None,
                         "bodyParts": [], "equipments": [], "targetMuscles": [], "secondaryMuscles": [],
                         "exerciseType": None, "instructions": [], "overview": None, "exerciseTips": []}]


@respx.mock
def test_list_drops_empty_filters_and_paginates(client):
    route = respx.get(f"{BASE_URL}/exercises").mock(return_value=httpx.Response(200, json={
        "success": True, "meta": {"total": 30, "hasNextPage": True, "nextCursor": "c2"},
        "data": [{"exerciseId": "e2", "name": "Fly", "bodyParts": ["CHEST"]}]}))
    r = client.get("/exercises", params={"bodyParts": "chest", "equipments": "", "after": "c1", "limit": 10})
    assert r.status_code == 200
    sent = route.calls.last.request.url.params
    assert sent["bodyParts"] == "chest" and "equipments" not in sent and sent["after"] == "c1" and sent["limit"] == "10"
    body = r.json()
    assert body["nextCursor"] == "c2" and body["hasNextPage"] is True and body["data"][0]["name"] == "Fly"


@respx.mock
def test_upstream_failures_become_502_or_404(client):
    respx.get(f"{BASE_URL}/exercises/nope").mock(return_value=httpx.Response(404, json={"success": False}))
    assert client.get("/exercises/nope").status_code == 404
    respx.get(f"{BASE_URL}/exercises/boom").mock(return_value=httpx.Response(500, text="err"))
    assert client.get("/exercises/boom").status_code == 502
    respx.get(f"{BASE_URL}/exercises/down").mock(side_effect=httpx.ConnectError("down"))
    assert client.get("/exercises/down").status_code == 502


def test_filters_vocab(client):
    r = client.get("/exercises/filters")
    assert r.status_code == 200 and "CHEST" in r.json()["bodyParts"] and "DUMBBELL" in r.json()["equipments"]
