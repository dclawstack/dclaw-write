import pytest


SAMPLE = (
    "Markets churned through the morning, then settled into a familiar drift. "
    "Bond yields nudged up; equities slipped a touch. Traders watched the tape "
    "and waited — the only reasonable response when the data refuses to commit."
)


@pytest.mark.asyncio
async def test_create_profile_then_fit(client):
    created = await client.post("/api/v1/brand-profiles", json={"name": "Macro voice"})
    assert created.status_code == 201
    profile = created.json()
    pid = profile["id"]
    assert profile["sample_count"] == 0
    assert profile["style_features"] == {}

    added = await client.post(
        f"/api/v1/brand-profiles/{pid}/samples",
        json={"text": SAMPLE, "label": "newsletter"},
    )
    assert added.status_code == 201
    refreshed = added.json()
    assert refreshed["sample_count"] == 1
    assert refreshed["total_tokens"] > 0
    assert refreshed["style_features"]["mean_sentence_length"] > 0
    assert refreshed["bigram_signature"]


@pytest.mark.asyncio
async def test_voice_match_self_is_high(client):
    created = await client.post("/api/v1/brand-profiles", json={"name": "Self"})
    pid = created.json()["id"]
    await client.post(
        f"/api/v1/brand-profiles/{pid}/samples", json={"text": SAMPLE},
    )

    match = await client.post(
        f"/api/v1/brand-profiles/{pid}/voice-match", json={"text": SAMPLE}
    )
    assert match.status_code == 200
    body = match.json()
    assert body["score"] >= 50
    assert "mean_sentence_length" in body["sample_features"]


@pytest.mark.asyncio
async def test_list_samples_after_upload(client):
    created = await client.post("/api/v1/brand-profiles", json={"name": "List me"})
    pid = created.json()["id"]
    await client.post(f"/api/v1/brand-profiles/{pid}/samples", json={"text": SAMPLE})
    await client.post(f"/api/v1/brand-profiles/{pid}/samples", json={"text": SAMPLE})

    samples = await client.get(f"/api/v1/brand-profiles/{pid}/samples")
    assert samples.status_code == 200
    assert len(samples.json()) == 2


@pytest.mark.asyncio
async def test_delete_brand_profile(client):
    created = await client.post("/api/v1/brand-profiles", json={"name": "Trash"})
    pid = created.json()["id"]

    deleted = await client.delete(f"/api/v1/brand-profiles/{pid}")
    assert deleted.status_code == 204

    missing = await client.get(f"/api/v1/brand-profiles/{pid}")
    assert missing.status_code == 404
