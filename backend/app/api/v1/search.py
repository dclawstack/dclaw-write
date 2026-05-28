"""Web + semantic + voice-neighbor search endpoints (plan items 2.2, 2.3)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.document import Document
from app.repositories.brand_profile_repo import BrandProfileRepository
from app.repositories.document_repo import DocumentRepository
from app.repositories.embedding_repo import EmbeddingRepository
from app.schemas.retrieval import (
    GroundedSourceRead,
    GroundRequest,
    GroundResponse,
    PlatformInfo,
    SemanticSearchHit,
    SemanticSearchRequest,
    SemanticSearchResponse,
    VoiceNeighbor,
    VoiceNeighborsResponse,
    WebSearchRequest,
    WebSearchResponse,
    WebSearchResult,
)
from app.services.embeddings import cosine_similarity, generate_embedding, knn
from app.services.grounding import ground_claim, web_search
from app.services.repurpose import available_platforms

router = APIRouter()


@router.post("/web", response_model=WebSearchResponse)
async def search_web(payload: WebSearchRequest) -> WebSearchResponse:
    results = await web_search(payload.query, max_results=payload.max_results)
    return WebSearchResponse(
        query=payload.query,
        results=[
            WebSearchResult(
                title=r.title, url=r.url, snippet=r.snippet, provider=r.provider
            )
            for r in results
        ],
    )


@router.post("/ground", response_model=GroundResponse)
async def ground(payload: GroundRequest) -> GroundResponse:
    sources = await ground_claim(
        payload.claim,
        max_results=payload.max_results,
        accept_threshold=payload.accept_threshold,
    )
    return GroundResponse(
        claim=payload.claim,
        sources=[
            GroundedSourceRead(
                title=s.title,
                url=s.url,
                snippet=s.snippet,
                provider=s.provider,
                support_score=s.support_score,
                verified=s.verified,
            )
            for s in sources
        ],
    )


@router.post("/semantic", response_model=SemanticSearchResponse)
async def semantic_search(
    payload: SemanticSearchRequest,
    db: AsyncSession = Depends(get_db),
) -> SemanticSearchResponse:
    query_vec = await generate_embedding(payload.query)

    embed_repo = EmbeddingRepository(db)
    rows = await embed_repo.list_by_type("document", purpose="semantic")
    if not rows:
        return SemanticSearchResponse(results=[])

    scored = knn(query_vec.vector, [(str(r.entity_id), r.vector) for r in rows], k=payload.k)

    doc_repo = DocumentRepository(db)
    hits: list[SemanticSearchHit] = []
    for doc_id_str, score in scored:
        try:
            doc_uuid = uuid.UUID(doc_id_str)
        except ValueError:
            continue
        doc = await doc_repo.get_by_id(doc_uuid)
        if doc is None:
            continue
        hits.append(SemanticSearchHit(document_id=doc.id, title=doc.title, score=round(score, 4)))
    return SemanticSearchResponse(results=hits)


@router.get("/platforms", response_model=list[PlatformInfo])
async def list_platforms() -> list[PlatformInfo]:
    return [PlatformInfo(**p) for p in available_platforms()]


@router.get("/voice-neighbors/{profile_id}", response_model=VoiceNeighborsResponse)
async def voice_neighbors(
    profile_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> VoiceNeighborsResponse:
    profile_repo = BrandProfileRepository(db)
    profile = await profile_repo.get_by_id(profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Brand profile not found")

    embed_repo = EmbeddingRepository(db)
    own = await embed_repo.get_for_entity("brand_profile", profile_id, purpose="voice")
    if own is None:
        return VoiceNeighborsResponse(profile_id=profile_id, neighbors=[])

    all_rows = await embed_repo.list_by_type("brand_profile", purpose="voice")
    others = [r for r in all_rows if r.entity_id != profile_id]
    if not others:
        return VoiceNeighborsResponse(profile_id=profile_id, neighbors=[])

    profiles_by_id: dict[uuid.UUID, str] = {}
    for row in others:
        other_profile = await profile_repo.get_by_id(row.entity_id)
        if other_profile is not None:
            profiles_by_id[row.entity_id] = other_profile.name

    scored: list[VoiceNeighbor] = []
    for row in others:
        if row.entity_id not in profiles_by_id:
            continue
        score = cosine_similarity(own.vector, row.vector)
        scored.append(
            VoiceNeighbor(
                brand_profile_id=row.entity_id,
                name=profiles_by_id[row.entity_id],
                similarity=round(score, 4),
            )
        )
    scored.sort(key=lambda n: n.similarity, reverse=True)
    return VoiceNeighborsResponse(profile_id=profile_id, neighbors=scored[:5])
