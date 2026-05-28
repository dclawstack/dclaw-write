"""AI Copilot tests.

The mock fallback in ``app.services.ai.client`` runs whenever Ollama and
OpenRouter are unreachable — which is the case in CI. These tests exercise
the full surrounding pipeline (style prompt, telemetry, scoring, feedback)
against that deterministic fallback.
"""
import pytest

SAMPLE = (
    "Markets churned through the morning, then settled into a familiar drift. "
    "Bond yields nudged up; equities slipped a touch. Traders watched the tape "
    "and waited — the only reasonable response when the data refuses to commit."
)


async def _make_brand(client) -> str:
    created = await client.post("/api/v1/brand-profiles", json={"name": "Voice"})
    pid = created.json()["id"]
    await client.post(f"/api/v1/brand-profiles/{pid}/samples", json={"text": SAMPLE})
    return pid


@pytest.mark.asyncio
async def test_complete_returns_text_and_voice_match(client):
    pid = await _make_brand(client)
    response = await client.post(
        "/api/v1/ai/complete",
        json={
            "brand_profile_id": pid,
            "prompt": "The narrator paused, listening for the next move.",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["text"]
    assert body["provider"] in {"ollama", "openrouter", "mock"}
    assert body["suggestion_id"]
    assert isinstance(body["voice_match_score"], int)


@pytest.mark.asyncio
async def test_complete_works_without_brand_profile(client):
    response = await client.post(
        "/api/v1/ai/complete",
        json={"prompt": "Begin a paragraph about a city at night."},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["text"]
    assert body["voice_match_score"] is None


@pytest.mark.asyncio
async def test_feedback_marks_suggestion_accepted(client):
    completion = await client.post(
        "/api/v1/ai/complete",
        json={"prompt": "An opening sentence is needed here."},
    )
    sid = completion.json()["suggestion_id"]
    feedback = await client.post(
        f"/api/v1/ai/suggestions/{sid}/feedback",
        json={"accepted": True},
    )
    assert feedback.status_code == 200
    body = feedback.json()
    assert body["accepted"] is True
    assert body["resolved_at"] is not None


@pytest.mark.asyncio
async def test_readability_endpoint(client):
    response = await client.post(
        "/api/v1/ai/readability",
        json={"text": "Hello. World."},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["sentences"] == 2
    assert body["flesch_reading_ease"] > 0


@pytest.mark.asyncio
async def test_stream_endpoint_yields_chunks(client):
    response = await client.post(
        "/api/v1/ai/stream",
        json={"prompt": "Stream a continuation about a rainy night in the city."},
    )
    assert response.status_code == 200
    text = response.text
    assert "data: " in text
    assert '"type": "meta"' in text
    assert '"type": "done"' in text
