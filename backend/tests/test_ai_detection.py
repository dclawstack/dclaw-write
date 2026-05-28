import pytest

from app.services.ai_detection import analyze


HUMAN_SAMPLE = (
    "Markets churned through the morning, then settled into a familiar drift. "
    "Bond yields nudged up; equities slipped a touch. Traders watched the tape "
    "and waited — the only reasonable response when the data refuses to commit. "
    "The mood was hesitant; the prints, unhelpful. Few moved."
)
AI_SAMPLE = (
    "Artificial intelligence is a powerful technology. Artificial intelligence "
    "is transforming many industries. Artificial intelligence is being used in "
    "various ways. Artificial intelligence is important. Artificial intelligence "
    "is the future."
)


def test_human_sample_scores_higher_than_ai_sample():
    human = analyze(HUMAN_SAMPLE)
    ai = analyze(AI_SAMPLE)
    assert human["score"] > ai["score"]
    assert human["score"] >= 55


def test_repetitive_text_gets_suggestions():
    report = analyze(AI_SAMPLE)
    assert report["suggestions"]
    assert any("opening" in s.lower() or "sentence" in s.lower() for s in report["suggestions"])


def test_short_text_returns_neutral():
    report = analyze("Hi.")
    assert report["label"] == "not enough text"
    assert report["score"] == 0


@pytest.mark.asyncio
async def test_detection_endpoint(client):
    response = await client.post(
        "/api/v1/ai/detection", json={"text": HUMAN_SAMPLE}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["score"] >= 55
    assert body["label"] in {"human-looking", "borderline", "AI-looking"}
    assert "burstiness" in body
