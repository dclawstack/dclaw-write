import pytest


async def _doc(client) -> str:
    pid = (await client.post("/api/v1/projects", json={"name": "P"})).json()["id"]
    return (
        await client.post(
            "/api/v1/documents",
            json={"project_id": pid, "title": "D", "content": "Claim about the world."},
        )
    ).json()["id"]


@pytest.mark.asyncio
async def test_create_list_citation(client):
    did = await _doc(client)
    response = await client.post(
        f"/api/v1/documents/{did}/citations",
        json={
            "claim": "The sky was clear.",
            "source_url": "https://example.com/weather",
            "source_title": "Weather Report",
            "paragraph_index": 0,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["verified"] is False
    assert body["source_title"] == "Weather Report"

    listing = await client.get(f"/api/v1/documents/{did}/citations")
    assert listing.status_code == 200
    assert len(listing.json()) == 1


@pytest.mark.asyncio
async def test_update_citation_verify(client):
    did = await _doc(client)
    created = await client.post(
        f"/api/v1/documents/{did}/citations",
        json={"claim": "x", "source_url": "https://example.com/x"},
    )
    cid = created.json()["id"]

    patched = await client.patch(
        f"/api/v1/citations/{cid}",
        json={"verified": True, "source_title": "Verified Source"},
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["verified"] is True
    assert body["source_title"] == "Verified Source"


@pytest.mark.asyncio
async def test_delete_citation(client):
    did = await _doc(client)
    created = await client.post(
        f"/api/v1/documents/{did}/citations",
        json={"claim": "x", "source_url": "https://example.com/x"},
    )
    cid = created.json()["id"]
    deleted = await client.delete(f"/api/v1/citations/{cid}")
    assert deleted.status_code == 204


@pytest.mark.asyncio
async def test_citation_requires_existing_document(client):
    response = await client.post(
        "/api/v1/documents/00000000-0000-0000-0000-000000000000/citations",
        json={"claim": "x", "source_url": "https://example.com/x"},
    )
    assert response.status_code == 404
