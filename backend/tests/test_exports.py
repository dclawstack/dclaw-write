import io
import zipfile

import pytest


async def _project(client) -> str:
    return (await client.post("/api/v1/projects", json={"name": "Export"})).json()["id"]


async def _document(client, project_id: str, title="Hello", content="# Intro\n\nThe sky was clear.") -> str:
    response = await client.post(
        "/api/v1/documents",
        json={"project_id": project_id, "title": title, "content": content},
    )
    return response.json()["id"]


@pytest.mark.asyncio
async def test_export_markdown(client):
    pid = await _project(client)
    did = await _document(client, pid)
    response = await client.get(f"/api/v1/documents/{did}/export?format=md")
    assert response.status_code == 200
    assert "text/markdown" in response.headers["content-type"]
    assert "# Hello" in response.text
    assert "The sky was clear." in response.text


@pytest.mark.asyncio
async def test_export_html(client):
    pid = await _project(client)
    did = await _document(client, pid, content="# Section\n\nBody.")
    response = await client.get(f"/api/v1/documents/{did}/export?format=html")
    assert response.status_code == 200
    body = response.text
    assert "<!doctype html>" in body
    assert "<h1>Hello</h1>" in body
    assert "<h1>Section</h1>" in body


@pytest.mark.asyncio
async def test_export_docx(client):
    pid = await _project(client)
    did = await _document(client, pid)
    response = await client.get(f"/api/v1/documents/{did}/export?format=docx")
    assert response.status_code == 200
    assert (
        response.headers["content-type"]
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    # A DOCX is a ZIP container — make sure we produced a valid one.
    bio = io.BytesIO(response.content)
    with zipfile.ZipFile(bio) as zf:
        names = zf.namelist()
    assert "word/document.xml" in names


@pytest.mark.asyncio
async def test_export_unknown_format(client):
    pid = await _project(client)
    did = await _document(client, pid)
    response = await client.get(f"/api/v1/documents/{did}/export?format=epub")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_export_unknown_document(client):
    response = await client.get(
        "/api/v1/documents/00000000-0000-0000-0000-000000000000/export?format=md"
    )
    assert response.status_code == 404
