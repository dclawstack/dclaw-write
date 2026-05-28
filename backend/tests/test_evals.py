import pytest

from app.services.evals import evaluate

LONG = "This is a clear sentence. " * 30


def test_evaluate_returns_grade():
    report = evaluate(LONG, [{"verified": True, "source_url": "x"}])
    assert report["word_count"] > 50
    assert report["grade"] in {"A", "B", "C", "D"}
    assert report["citation_density"] > 0
    assert report["verified_citation_ratio"] == 1.0


def test_evaluate_short_text_no_grade():
    report = evaluate("Too short.", [])
    assert report["grade"] == "—"


def test_evaluate_flags_unsupported_claims():
    text = (
        "According to recent reports, 73% of teams ship faster. "
        "Studies show that habits matter."
    )
    report = evaluate(text, [])
    assert report["claims_needing_sources"] >= 2


@pytest.mark.asyncio
async def test_eval_endpoint_with_brand_profile(client):
    pid = (await client.post("/api/v1/projects", json={"name": "Eval"})).json()["id"]
    document = await client.post(
        "/api/v1/documents",
        json={"project_id": pid, "title": "T", "content": LONG},
    )
    did = document.json()["id"]

    brand = await client.post("/api/v1/brand-profiles", json={"name": "Voice"})
    bid = brand.json()["id"]
    await client.post(
        f"/api/v1/brand-profiles/{bid}/samples",
        json={"text": LONG},
    )

    response = await client.post(
        f"/api/v1/documents/{did}/eval",
        json={"brand_profile_id": bid},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["voice_match_score"] is not None
    assert body["grade"] in {"A", "B", "C", "D"}


@pytest.mark.asyncio
async def test_eval_endpoint_without_brand_profile(client):
    pid = (await client.post("/api/v1/projects", json={"name": "Eval"})).json()["id"]
    document = await client.post(
        "/api/v1/documents",
        json={"project_id": pid, "title": "T", "content": LONG},
    )
    did = document.json()["id"]
    response = await client.post(f"/api/v1/documents/{did}/eval", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["voice_match_score"] is None
    assert body["grade"] in {"A", "B", "C", "D"}
