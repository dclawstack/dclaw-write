import pytest


async def _create_project(client, name="Project"):
    response = await client.post("/api/v1/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


@pytest.mark.asyncio
async def test_create_document_computes_word_count(client):
    project_id = await _create_project(client)

    response = await client.post(
        "/api/v1/documents",
        json={
            "project_id": project_id,
            "title": "First post",
            "content": "Hello world from DClaw Write.",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["title"] == "First post"
    assert body["word_count"] == 5
    assert body["reading_time_seconds"] >= 1
    assert body["status"] == "draft"


@pytest.mark.asyncio
async def test_create_document_requires_existing_project(client):
    response = await client.post(
        "/api/v1/documents",
        json={
            "project_id": "00000000-0000-0000-0000-000000000000",
            "title": "Ghost",
            "content": "",
        },
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_document_creates_revision(client):
    project_id = await _create_project(client)
    created = await client.post(
        "/api/v1/documents",
        json={"project_id": project_id, "title": "Draft", "content": "Original body."},
    )
    doc_id = created.json()["id"]

    updated = await client.patch(
        f"/api/v1/documents/{doc_id}",
        json={"content": "A revised body of work spanning many more words now."},
    )
    assert updated.status_code == 200
    assert updated.json()["word_count"] == 10

    revisions = await client.get(f"/api/v1/documents/{doc_id}/revisions")
    assert revisions.status_code == 200
    history = revisions.json()
    assert len(history) == 1
    assert history[0]["word_count"] == 2  # snapshot of the prior content


@pytest.mark.asyncio
async def test_list_documents_filtered_by_project(client):
    project_a = await _create_project(client, "A")
    project_b = await _create_project(client, "B")
    await client.post(
        "/api/v1/documents",
        json={"project_id": project_a, "title": "Doc A1", "content": ""},
    )
    await client.post(
        "/api/v1/documents",
        json={"project_id": project_b, "title": "Doc B1", "content": ""},
    )

    response = await client.get("/api/v1/documents", params={"project_id": project_a})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "Doc A1"


@pytest.mark.asyncio
async def test_delete_document(client):
    project_id = await _create_project(client)
    created = await client.post(
        "/api/v1/documents",
        json={"project_id": project_id, "title": "Temp", "content": ""},
    )
    doc_id = created.json()["id"]

    deleted = await client.delete(f"/api/v1/documents/{doc_id}")
    assert deleted.status_code == 204

    missing = await client.get(f"/api/v1/documents/{doc_id}")
    assert missing.status_code == 404
