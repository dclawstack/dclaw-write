import uuid
from datetime import datetime, timezone
from random import randint

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class CreateDocumentRequest(BaseModel):
    title: str
    content_type: str
    topic: str


class DocumentResponse(BaseModel):
    id: str
    title: str
    content_type: str
    outline: list[str]
    word_count: int
    status: str
    created_at: str


@router.post("/documents")
async def create_document(req: CreateDocumentRequest):
    return DocumentResponse(
        id=str(uuid.uuid4()),
        title=req.title,
        content_type=req.content_type,
        outline=["Introduction", "Body", "Conclusion"],
        word_count=randint(500, 5000),
        status="draft",
        created_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/documents/{id}/outline")
async def get_document_outline(id: str):
    return ["Introduction", "Body", "Conclusion"]
