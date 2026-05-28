import pytest

from app.services.analytics import estimate_cost_cents


def test_estimate_cost_zero_for_ollama_and_mock():
    assert estimate_cost_cents("ollama", "any", 1000, 2000) == 0.0
    assert estimate_cost_cents("mock", "any", 1000, 2000) == 0.0


def test_estimate_cost_nonzero_for_paid_provider():
    cost = estimate_cost_cents(
        "openrouter", "meta-llama/llama-3.1-8b-instruct", 4000, 4000
    )
    assert cost > 0


@pytest.mark.asyncio
async def test_dashboard_endpoint_empty(client):
    response = await client.get("/api/v1/analytics/dashboard")
    assert response.status_code == 200
    body = response.json()
    assert body["total_completions"] == 0
    assert body["providers"] == []


@pytest.mark.asyncio
async def test_dashboard_after_a_completion(client):
    await client.post(
        "/api/v1/ai/complete",
        json={"prompt": "Continue this sentence about a city at night."},
    )
    response = await client.get("/api/v1/analytics/dashboard")
    body = response.json()
    assert body["total_completions"] == 1
    assert len(body["providers"]) == 1
    assert body["providers"][0]["completions"] == 1
    assert body["recent"][0]["provider"]


@pytest.mark.asyncio
async def test_dashboard_reflects_feedback(client):
    completion = await client.post(
        "/api/v1/ai/complete", json={"prompt": "A prompt that needs a continuation."}
    )
    sid = completion.json()["suggestion_id"]
    await client.post(
        f"/api/v1/ai/suggestions/{sid}/feedback", json={"accepted": True}
    )
    dash = await client.get("/api/v1/analytics/dashboard")
    body = dash.json()
    assert body["accepted"] == 1
    assert body["accept_rate"] == 1.0
