import pytest


@pytest.mark.asyncio
async def test_pipeline_runs_all_steps(client):
    response = await client.post(
        "/api/v1/pipelines",
        json={"topic": "How small teams ship fast"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "completed"
    assert body["final_draft"]
    artifacts = body["artifacts"]
    for step in ("planner", "researcher", "drafter", "editor", "fact_checker"):
        assert step in artifacts, f"missing {step} artifact"


@pytest.mark.asyncio
async def test_pipeline_get_then_list(client):
    created = await client.post("/api/v1/pipelines", json={"topic": "Topic A"})
    pid = created.json()["id"]

    fetched = await client.get(f"/api/v1/pipelines/{pid}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == pid

    listing = await client.get("/api/v1/pipelines")
    assert listing.status_code == 200
    body = listing.json()
    assert body["total"] >= 1


@pytest.mark.asyncio
async def test_pipeline_with_unknown_brand_404s(client):
    response = await client.post(
        "/api/v1/pipelines",
        json={
            "topic": "Topic",
            "brand_profile_id": "00000000-0000-0000-0000-000000000000",
        },
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_pipeline_artifacts_inspectable(client):
    response = await client.post("/api/v1/pipelines", json={"topic": "Quiet rooms"})
    artifacts = response.json()["artifacts"]
    assert isinstance(artifacts["planner"]["sections"], list)
    assert artifacts["planner"]["sections"]
    assert isinstance(artifacts["researcher"]["sections"], list)
    assert "draft" in artifacts["drafter"]
    assert "claims_needing_sources" in artifacts["fact_checker"]
