import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.text import count_words, reading_time_seconds
from app.models.citation import Citation
from app.models.document import Document
from app.models.revision import Revision
from app.repositories.brand_profile_repo import BrandProfileRepository
from app.repositories.citation_repo import CitationRepository
from app.repositories.document_repo import DocumentRepository, RevisionRepository
from app.repositories.embedding_repo import EmbeddingRepository
from app.repositories.project_repo import ProjectRepository
from app.schemas.document import (
    DocumentCreate,
    DocumentList,
    DocumentRead,
    DocumentUpdate,
    RevisionRead,
)
from app.schemas.pipeline import EvalRequest, EvalResponse
from app.schemas.retrieval import (
    AutoGroundRequest,
    AutoGroundResponse,
    EmbeddingRead,
    RepurposeRequest,
    RepurposeResponse,
)
from app.services.ai import get_ai_client
from app.services.embeddings import generate_embedding
from app.services.evals import evaluate
from app.services.exports import safe_filename, to_docx, to_html, to_markdown
from app.services.grounding import ground_claim
from app.services.repurpose import repurpose

_SUSPECT_RE = re.compile(
    r"\b(\d{2,}%|\d{4}|according to|studies show|research finds|"
    r"economists|reports|surveyed|the data)\b",
    re.IGNORECASE,
)

router = APIRouter()


@router.get("", response_model=DocumentList)
async def list_documents(
    project_id: Optional[uuid.UUID] = Query(default=None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> DocumentList:
    repo = DocumentRepository(db)
    if project_id is not None:
        items, total = await repo.list_by_project(project_id, limit=limit, offset=offset)
    else:
        items, total = await repo.list_all(limit=limit, offset=offset)
    return DocumentList(items=[DocumentRead.model_validate(i) for i in items], total=total)


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def create_document(
    payload: DocumentCreate,
    db: AsyncSession = Depends(get_db),
) -> DocumentRead:
    project = await ProjectRepository(db).get_by_id(payload.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    words = count_words(payload.content)
    doc = Document(
        project_id=payload.project_id,
        title=payload.title,
        content_type=payload.content_type,
        content=payload.content,
        word_count=words,
        reading_time_seconds=reading_time_seconds(payload.content),
    )
    created = await DocumentRepository(db).create(doc)
    return DocumentRead.model_validate(created)


@router.get("/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> DocumentRead:
    document = await DocumentRepository(db).get_by_id(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentRead.model_validate(document)


@router.patch("/{document_id}", response_model=DocumentRead)
async def update_document(
    document_id: uuid.UUID,
    payload: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
) -> DocumentRead:
    repo = DocumentRepository(db)
    document = await repo.get_by_id(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    changes = payload.model_dump(exclude_unset=True)
    content_changed = "content" in changes and changes["content"] != document.content

    if content_changed:
        new_content = changes["content"] or ""
        changes["word_count"] = count_words(new_content)
        changes["reading_time_seconds"] = reading_time_seconds(new_content)
        db.add(
            Revision(
                document_id=document.id,
                content=document.content,
                word_count=document.word_count,
            )
        )

    updated = await repo.update(document, **changes)
    return DocumentRead.model_validate(updated)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    repo = DocumentRepository(db)
    document = await repo.get_by_id(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    await repo.delete(document)


@router.get("/{document_id}/revisions", response_model=list[RevisionRead])
async def list_revisions(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[RevisionRead]:
    document = await DocumentRepository(db).get_by_id(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    revisions = await RevisionRepository(db).list_for_document(document_id)
    return [RevisionRead.model_validate(r) for r in revisions]


_EXPORT_FORMATS = {"md", "html", "docx"}


@router.get("/{document_id}/export")
async def export_document(
    document_id: uuid.UUID,
    format: str = Query("md", description="md, html, or docx"),
    db: AsyncSession = Depends(get_db),
) -> Response:
    fmt = format.lower()
    if fmt not in _EXPORT_FORMATS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")

    document = await DocumentRepository(db).get_by_id(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    filename_stem = safe_filename(document.title)

    if fmt == "md":
        body = to_markdown(document.title, document.content)
        return PlainTextResponse(
            body,
            media_type="text/markdown; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename_stem}.md"'
            },
        )

    if fmt == "html":
        body = to_html(document.title, document.content)
        return Response(
            content=body,
            media_type="text/html; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename_stem}.html"'
            },
        )

    body = to_docx(document.title, document.content)
    return Response(
        content=body,
        media_type=(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        headers={
            "Content-Disposition": f'attachment; filename="{filename_stem}.docx"'
        },
    )


@router.post("/{document_id}/eval", response_model=EvalResponse)
async def eval_document(
    document_id: uuid.UUID,
    payload: EvalRequest,
    db: AsyncSession = Depends(get_db),
) -> EvalResponse:
    document = await DocumentRepository(db).get_by_id(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    profile_features = {}
    profile_bigrams = {}
    if payload.brand_profile_id is not None:
        profile = await BrandProfileRepository(db).get_by_id(payload.brand_profile_id)
        if profile is None:
            raise HTTPException(status_code=404, detail="Brand profile not found")
        profile_features = profile.style_features or {}
        profile_bigrams = profile.bigram_signature or {}

    citations = await CitationRepository(db).list_for_document(document_id)
    citations_payload = [
        {"verified": bool(c.verified), "source_url": c.source_url}
        for c in citations
    ]

    report = evaluate(
        text=document.content,
        citations=citations_payload,
        profile_features=profile_features,
        profile_bigrams=profile_bigrams,
    )
    return EvalResponse(**report)


@router.post("/{document_id}/embed", response_model=EmbeddingRead)
async def embed_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> EmbeddingRead:
    document = await DocumentRepository(db).get_by_id(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    text = f"{document.title}\n\n{document.content}".strip()
    result = await generate_embedding(text)
    row = await EmbeddingRepository(db).upsert(
        entity_type="document",
        entity_id=document.id,
        purpose="semantic",
        model=result.model,
        vector=result.vector,
    )
    return EmbeddingRead.model_validate(row)


@router.post("/{document_id}/ground", response_model=AutoGroundResponse)
async def auto_ground(
    document_id: uuid.UUID,
    payload: AutoGroundRequest,
    db: AsyncSession = Depends(get_db),
) -> AutoGroundResponse:
    """Sweep the doc for load-bearing claims and seed `Citation` rows.

    Verification is the bag-of-words overlap from ``ground_claim``; the
    ``verified`` flag flips automatically when overlap clears ``accept_threshold``.
    A real LLM-as-judge pass is a drop-in replacement once a model server is
    wired in production.
    """
    document = await DocumentRepository(db).get_by_id(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    sentences = re.split(r"(?<=[.!?])\s+", document.content.strip())
    suspect = [s for s in sentences if _SUSPECT_RE.search(s)][: payload.max_claims]
    skipped = len(sentences) - len(suspect)

    citation_repo = CitationRepository(db)
    created_ids: list[uuid.UUID] = []
    for paragraph_index, claim in enumerate(suspect):
        sources = await ground_claim(
            claim,
            max_results=3,
            accept_threshold=payload.accept_threshold,
        )
        if not sources:
            continue
        best = sources[0]
        citation = Citation(
            document_id=document.id,
            paragraph_index=paragraph_index,
            claim=claim.strip(),
            source_url=best.url,
            source_title=best.title,
            source_snippet=best.snippet,
            verified=best.verified,
        )
        created = await citation_repo.create(citation)
        created_ids.append(created.id)

    return AutoGroundResponse(
        document_id=document.id,
        created_citation_ids=created_ids,
        skipped_sentences=max(0, skipped),
    )


@router.post("/{document_id}/repurpose", response_model=RepurposeResponse)
async def repurpose_document(
    document_id: uuid.UUID,
    payload: RepurposeRequest,
    db: AsyncSession = Depends(get_db),
) -> RepurposeResponse:
    document = await DocumentRepository(db).get_by_id(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    style_features = {}
    bigram_signature = {}
    if payload.brand_profile_id is not None:
        profile = await BrandProfileRepository(db).get_by_id(payload.brand_profile_id)
        if profile is None:
            raise HTTPException(status_code=404, detail="Brand profile not found")
        style_features = profile.style_features or {}
        bigram_signature = profile.bigram_signature or {}

    try:
        result = await repurpose(
            client=get_ai_client(),
            text=document.content,
            platform=payload.platform,
            style_features=style_features,
            bigram_signature=bigram_signature,
            instruction=payload.instruction,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return RepurposeResponse(**result)
