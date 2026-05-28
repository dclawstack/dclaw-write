import pytest

from app.services.translation import cultural_review, supported_languages


def test_cultural_review_flags_us_specific_refs():
    findings = cultural_review(
        "Brought to you by the NFL during the Super Bowl. Costs $50 at Walmart."
    )
    matches = [f["match"] for f in findings]
    assert "Super Bowl" in matches
    assert "NFL" in matches
    assert "$50" in matches
    assert "Walmart" in matches


def test_cultural_review_clean_text():
    findings = cultural_review("A quiet morning at the harbor.")
    assert findings == []


def test_supported_languages_listed():
    langs = supported_languages()
    codes = {l["code"] for l in langs}
    assert {"es", "fr", "de", "ja"}.issubset(codes)


@pytest.mark.asyncio
async def test_translate_endpoint(client):
    response = await client.post(
        "/api/v1/ai/translate",
        json={"text": "Small teams ship fast.", "target_language": "es"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["target_language"] == "es"
    assert body["text"]
    assert body["cultural_review"] == []


@pytest.mark.asyncio
async def test_translate_includes_cultural_review(client):
    response = await client.post(
        "/api/v1/ai/translate",
        json={
            "text": "The NFL had a record Super Bowl. Tickets cost $500.",
            "target_language": "es",
        },
    )
    assert response.status_code == 200
    matches = [f["match"] for f in response.json()["cultural_review"]]
    assert "NFL" in matches


@pytest.mark.asyncio
async def test_languages_endpoint(client):
    response = await client.get("/api/v1/ai/languages")
    assert response.status_code == 200
    codes = {l["code"] for l in response.json()}
    assert "es" in codes
