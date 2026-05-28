import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.citation import Citation
from app.repositories.citation_repo import CitationRepository
from app.repositories.document_repo import DocumentRepository
from app.schemas.citation import CitationCreate, CitationRead, CitationUpdate

router = APIRouter()


@router.get("/documents/{document_id}/citations", response_model=list[CitationRead])
async def list_citations(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[CitationRead]:
    document = await DocumentRepository(db).get_by_id(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    items = await CitationRepository(db).list_for_document(document_id)
    return [CitationRead.model_validate(c) for c in items]


@router.post(
    "/documents/{document_id}/citations",
    response_model=CitationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_citation(
    document_id: uuid.UUID,
    payload: CitationCreate,
    db: AsyncSession = Depends(get_db),
) -> CitationRead:
    document = await DocumentRepository(db).get_by_id(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    citation = Citation(
        document_id=document_id,
        claim=payload.claim,
        source_url=payload.source_url,
        source_title=payload.source_title,
        source_snippet=payload.source_snippet,
        paragraph_index=payload.paragraph_index,
    )
    created = await CitationRepository(db).create(citation)
    return CitationRead.model_validate(created)


@router.patch("/citations/{citation_id}", response_model=CitationRead)
async def update_citation(
    citation_id: uuid.UUID,
    payload: CitationUpdate,
    db: AsyncSession = Depends(get_db),
) -> CitationRead:
    repo = CitationRepository(db)
    citation = await repo.get_by_id(citation_id)
    if citation is None:
        raise HTTPException(status_code=404, detail="Citation not found")
    fields = payload.model_dump(exclude_unset=True)
    if "verified" in fields:
        citation.verified = fields.pop("verified")
    updated = await repo.update(citation, **fields)
    return CitationRead.model_validate(updated)


@router.delete("/citations/{citation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_citation(
    citation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    repo = CitationRepository(db)
    citation = await repo.get_by_id(citation_id)
    if citation is None:
        raise HTTPException(status_code=404, detail="Citation not found")
    await repo.delete(citation)
