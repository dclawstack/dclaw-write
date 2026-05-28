import pytest

from app.services.grounding import ground_claim, support_score


SAMPLE_CLAIM = "Markets churned through the morning as bond yields nudged up."


def test_support_score_overlap():
    assert support_score(SAMPLE_CLAIM, SAMPLE_CLAIM) == 100
    assert support_score(SAMPLE_CLAIM, "Bond yields markets churned morning.") >= 50
    assert support_score(SAMPLE_CLAIM, "completely unrelated topic") < 25


@pytest.mark.asyncio
async def test_ground_claim_mock_fallback():
    sources = await ground_claim(SAMPLE_CLAIM, max_results=4)
    assert len(sources) > 0
    assert sources[0].support_score >= sources[-1].support_score  # sorted desc
    assert all(s.url.startswith("https://") for s in sources)


@pytest.mark.asyncio
async def test_web_search_endpoint(client):
    response = await client.post(
        "/api/v1/search/web", json={"query": "voice writing tool", "max_results": 3}
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["results"]) <= 3


@pytest.mark.asyncio
async def test_ground_endpoint(client):
    response = await client.post(
        "/api/v1/search/ground",
        json={"claim": SAMPLE_CLAIM, "max_results": 3, "accept_threshold": 30},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["claim"] == SAMPLE_CLAIM
    assert len(body["sources"]) > 0
    assert all("support_score" in s for s in body["sources"])


@pytest.mark.asyncio
async def test_auto_ground_creates_citations(client):
    pid = (await client.post("/api/v1/projects", json={"name": "G"})).json()["id"]
    doc = await client.post(
        "/api/v1/documents",
        json={
            "project_id": pid,
            "title": "Claims",
            "content": (
                "According to recent reports, 73% of teams ship faster. "
                "Studies show that habits matter."
            ),
        },
    )
    did = doc.json()["id"]

    response = await client.post(
        f"/api/v1/documents/{did}/ground",
        json={"accept_threshold": 30, "max_claims": 5},
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["created_citation_ids"]) >= 1

    citations = await client.get(f"/api/v1/documents/{did}/citations")
    items = citations.json()
    assert len(items) >= 1
    assert all(c["source_url"] for c in items)
