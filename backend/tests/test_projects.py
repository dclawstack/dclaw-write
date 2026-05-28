import pytest


@pytest.mark.asyncio
async def test_create_and_list_project(client):
    response = await client.post(
        "/api/v1/projects",
        json={"name": "Manuscript", "description": "Long-form draft"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Manuscript"
    assert body["description"] == "Long-form draft"
    assert body["id"]

    listing = await client.get("/api/v1/projects")
    assert listing.status_code == 200
    payload = listing.json()
    assert payload["total"] == 1
    assert len(payload["items"]) == 1
    assert payload["items"][0]["name"] == "Manuscript"


@pytest.mark.asyncio
async def test_update_and_delete_project(client):
    created = await client.post("/api/v1/projects", json={"name": "Draft"})
    project_id = created.json()["id"]

    patched = await client.patch(
        f"/api/v1/projects/{project_id}",
        json={"description": "Now with notes"},
    )
    assert patched.status_code == 200
    assert patched.json()["description"] == "Now with notes"

    deleted = await client.delete(f"/api/v1/projects/{project_id}")
    assert deleted.status_code == 204

    missing = await client.get(f"/api/v1/projects/{project_id}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_get_unknown_project(client):
    response = await client.get("/api/v1/projects/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
