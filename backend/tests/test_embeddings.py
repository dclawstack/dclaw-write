import pytest

from app.services.embeddings import cosine_similarity, generate_embedding, knn


@pytest.mark.asyncio
async def test_generate_embedding_mock():
    result = await generate_embedding("the cat sat on the mat")
    assert result.dim == len(result.vector) > 0
    assert result.provider == "mock"
    # deterministic
    again = await generate_embedding("the cat sat on the mat")
    assert again.vector == result.vector


@pytest.mark.asyncio
async def test_embeddings_match_themselves_more_than_others():
    a = (await generate_embedding("markets churned bond yields traders")).vector
    b = (await generate_embedding("markets churned bond yields traders")).vector
    c = (await generate_embedding("a rainy night by the harbor")).vector
    assert cosine_similarity(a, b) > cosine_similarity(a, c)


def test_knn_returns_top_k_sorted():
    query = [1.0, 0.0, 0.0]
    candidates = [
        ("a", [1.0, 0.0, 0.0]),
        ("b", [0.5, 0.5, 0.0]),
        ("c", [0.0, 1.0, 0.0]),
    ]
    top = knn(query, candidates, k=2)
    assert [t[0] for t in top] == ["a", "b"]


@pytest.mark.asyncio
async def test_semantic_search_endpoint(client):
    pid = (await client.post("/api/v1/projects", json={"name": "S"})).json()["id"]

    doc_a = await client.post(
        "/api/v1/documents",
        json={
            "project_id": pid,
            "title": "Markets and bonds",
            "content": "Markets churned. Bond yields nudged up. Traders waited.",
        },
    )
    doc_b = await client.post(
        "/api/v1/documents",
        json={
            "project_id": pid,
            "title": "Rainy night",
            "content": "A rainy night by the harbor. Streetlamps blinked on.",
        },
    )

    for did in (doc_a.json()["id"], doc_b.json()["id"]):
        embed_resp = await client.post(f"/api/v1/documents/{did}/embed")
        assert embed_resp.status_code == 200

    response = await client.post(
        "/api/v1/search/semantic", json={"query": "bond yields", "k": 2}
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["results"]) > 0
    assert body["results"][0]["title"] == "Markets and bonds"


@pytest.mark.asyncio
async def test_voice_neighbors_endpoint(client):
    a = await client.post("/api/v1/brand-profiles", json={"name": "A"})
    b = await client.post("/api/v1/brand-profiles", json={"name": "B"})
    aid = a.json()["id"]
    bid = b.json()["id"]
    await client.post(
        f"/api/v1/brand-profiles/{aid}/samples",
        json={"text": "Markets churned and bond yields nudged up across the board."},
    )
    await client.post(
        f"/api/v1/brand-profiles/{bid}/samples",
        json={"text": "Markets churned. Bond yields moved. Traders watched the tape."},
    )

    response = await client.get(f"/api/v1/search/voice-neighbors/{aid}")
    assert response.status_code == 200
    body = response.json()
    assert len(body["neighbors"]) == 1
    assert body["neighbors"][0]["brand_profile_id"] == bid
    assert 0.0 <= body["neighbors"][0]["similarity"] <= 1.0
