import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.utils import utc_now
from app.models.ai_suggestion import AISuggestion
from app.repositories.ai_suggestion_repo import AISuggestionRepository
from app.repositories.brand_profile_repo import BrandProfileRepository
from app.schemas.ai import (
    CompletionRequest,
    CompletionResponse,
    ReadabilityRequest,
    ReadabilityResponse,
    SuggestionFeedback,
    SuggestionRead,
)
from app.services.ai import build_style_prompt, get_ai_client, recent_context
from app.services.readability import analyze
from app.services.voice_dna import compute_features, voice_match_score

router = APIRouter()


async def _resolve_brand(
    db: AsyncSession,
    brand_profile_id: Optional[uuid.UUID],
):
    if brand_profile_id is None:
        return None
    profile = await BrandProfileRepository(db).get_by_id(brand_profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Brand profile not found")
    return profile


@router.post("/complete", response_model=CompletionResponse)
async def complete(
    payload: CompletionRequest,
    db: AsyncSession = Depends(get_db),
) -> CompletionResponse:
    profile = await _resolve_brand(db, payload.brand_profile_id)
    style_features = profile.style_features if profile else {}
    bigram_signature = profile.bigram_signature if profile else {}
    seed_bigrams = list(bigram_signature.keys()) if bigram_signature else []

    system = build_style_prompt(style_features, bigram_signature, payload.instruction)
    user_prompt = recent_context(payload.prompt)

    client = get_ai_client()
    result = await client.complete(
        system=system,
        prompt=user_prompt,
        max_tokens=payload.max_tokens,
        temperature=payload.temperature,
        seed_bigrams=seed_bigrams,
    )

    score = None
    if profile and result.text:
        sample_features = compute_features(result.text)
        score = voice_match_score(sample_features, {}, style_features, bigram_signature)

    suggestion = AISuggestion(
        document_id=payload.document_id,
        brand_profile_id=payload.brand_profile_id,
        prompt=user_prompt,
        output=result.text,
        provider=result.provider,
        model=result.model,
        latency_ms=result.latency_ms,
        voice_match_score=score,
    )
    saved = await AISuggestionRepository(db).create(suggestion)

    return CompletionResponse(
        suggestion_id=saved.id,
        text=result.text,
        provider=result.provider,
        model=result.model,
        latency_ms=result.latency_ms,
        voice_match_score=score,
    )


@router.post("/stream")
async def stream(
    payload: CompletionRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    profile = await _resolve_brand(db, payload.brand_profile_id)
    style_features = profile.style_features if profile else {}
    bigram_signature = profile.bigram_signature if profile else {}
    seed_bigrams = list(bigram_signature.keys()) if bigram_signature else []

    system = build_style_prompt(style_features, bigram_signature, payload.instruction)
    user_prompt = recent_context(payload.prompt)
    client = get_ai_client()

    suggestion = AISuggestion(
        document_id=payload.document_id,
        brand_profile_id=payload.brand_profile_id,
        prompt=user_prompt,
        output="",
        provider="pending",
        model="pending",
        latency_ms=0,
    )
    saved = await AISuggestionRepository(db).create(suggestion)

    async def event_stream():
        yield f"data: {json.dumps({'type': 'meta', 'suggestion_id': str(saved.id)})}\n\n"
        collected: list[str] = []
        async for chunk in client.stream(
            system=system,
            prompt=user_prompt,
            max_tokens=payload.max_tokens,
            temperature=payload.temperature,
            seed_bigrams=seed_bigrams,
        ):
            collected.append(chunk)
            yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"

        full_text = "".join(collected)
        score = None
        if profile and full_text:
            score = voice_match_score(
                compute_features(full_text),
                {},
                style_features,
                bigram_signature,
            )
        saved.output = full_text
        saved.voice_match_score = score
        await db.commit()
        yield f"data: {json.dumps({'type': 'done', 'voice_match_score': score})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/suggestions/{suggestion_id}", response_model=SuggestionRead)
async def get_suggestion(
    suggestion_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> SuggestionRead:
    suggestion = await AISuggestionRepository(db).get_by_id(suggestion_id)
    if suggestion is None:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    return SuggestionRead.model_validate(suggestion)


@router.post("/suggestions/{suggestion_id}/feedback", response_model=SuggestionRead)
async def submit_feedback(
    suggestion_id: uuid.UUID,
    payload: SuggestionFeedback,
    db: AsyncSession = Depends(get_db),
) -> SuggestionRead:
    repo = AISuggestionRepository(db)
    suggestion = await repo.get_by_id(suggestion_id)
    if suggestion is None:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    updated = await repo.update(
        suggestion,
        accepted=payload.accepted,
        resolved_at=utc_now(),
    )
    return SuggestionRead.model_validate(updated)


@router.post("/readability", response_model=ReadabilityResponse)
async def readability(payload: ReadabilityRequest) -> ReadabilityResponse:
    return ReadabilityResponse(**analyze(payload.text))


# ---------- Sprint 4 additions ----------


from app.schemas.sprint4 import (  # noqa: E402
    DetectionRequest,
    DetectionResponse,
    HeadlinesRequest,
    HeadlinesResponse,
    HeadlineVariant,
    LanguageOption,
    TranslationRequest,
    TranslationResponse,
)
from app.services.ai_detection import analyze as detection_analyze  # noqa: E402
from app.services.headlines import generate_headlines  # noqa: E402
from app.services.translation import (  # noqa: E402
    supported_languages,
    translate as translate_service,
)


@router.post("/detection", response_model=DetectionResponse)
async def detection(payload: DetectionRequest) -> DetectionResponse:
    return DetectionResponse(**detection_analyze(payload.text))


@router.post("/headlines", response_model=HeadlinesResponse)
async def headlines(
    payload: HeadlinesRequest,
    db: AsyncSession = Depends(get_db),
) -> HeadlinesResponse:
    profile_id: Optional[uuid.UUID] = None
    if payload.brand_profile_id:
        try:
            profile_id = uuid.UUID(payload.brand_profile_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid brand_profile_id")

    profile = await _resolve_brand(db, profile_id)
    style_features = profile.style_features if profile else {}
    bigram_signature = profile.bigram_signature if profile else {}

    variants = await generate_headlines(
        client=get_ai_client(),
        topic=payload.topic,
        body=payload.body or "",
        n=payload.n,
        style_features=style_features,
        bigram_signature=bigram_signature,
    )
    return HeadlinesResponse(
        variants=[HeadlineVariant(**v) for v in variants],
    )


@router.get("/languages", response_model=list[LanguageOption])
async def list_languages() -> list[LanguageOption]:
    return [LanguageOption(**lang) for lang in supported_languages()]


@router.post("/translate", response_model=TranslationResponse)
async def translate(
    payload: TranslationRequest,
    db: AsyncSession = Depends(get_db),
) -> TranslationResponse:
    profile_id: Optional[uuid.UUID] = None
    if payload.brand_profile_id:
        try:
            profile_id = uuid.UUID(payload.brand_profile_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid brand_profile_id")

    profile = await _resolve_brand(db, profile_id)
    style_features = profile.style_features if profile else {}
    bigram_signature = profile.bigram_signature if profile else {}

    result = await translate_service(
        client=get_ai_client(),
        text=payload.text,
        target_language=payload.target_language,
        style_features=style_features,
        bigram_signature=bigram_signature,
    )
    return TranslationResponse(**result)
