import pytest


@pytest.mark.asyncio
async def test_repurpose_for_each_platform(client):
    pid = (await client.post("/api/v1/projects", json={"name": "R"})).json()["id"]
    doc = await client.post(
        "/api/v1/documents",
        json={
            "project_id": pid,
            "title": "Why small teams ship fast",
            "content": (
                "Small teams ship fast because they remove coordination cost. "
                "The work fits in one head. The same person decides and executes."
            ),
        },
    )
    did = doc.json()["id"]
    for platform in ("twitter", "linkedin", "substack", "email", "ad"):
        response = await client.post(
            f"/api/v1/documents/{did}/repurpose",
            json={"platform": platform},
        )
        assert response.status_code == 200, f"{platform}: {response.text}"
        body = response.json()
        assert body["platform"] == platform
        assert body["text"]


@pytest.mark.asyncio
async def test_repurpose_unknown_platform(client):
    pid = (await client.post("/api/v1/projects", json={"name": "R"})).json()["id"]
    doc = await client.post(
        "/api/v1/documents",
        json={"project_id": pid, "title": "T", "content": "Body."},
    )
    did = doc.json()["id"]
    response = await client.post(
        f"/api/v1/documents/{did}/repurpose",
        json={"platform": "mastodon"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_platforms_listing(client):
    response = await client.get("/api/v1/search/platforms")
    assert response.status_code == 200
    keys = [p["key"] for p in response.json()]
    assert {"twitter", "linkedin", "substack", "email", "ad"}.issubset(set(keys))
