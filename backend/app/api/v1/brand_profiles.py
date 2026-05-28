import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.text import count_words
from app.models.brand_profile import BrandProfile
from app.models.voice_sample import VoiceSample
from app.repositories.brand_profile_repo import (
    BrandProfileRepository,
    VoiceSampleRepository,
)
from app.repositories.embedding_repo import EmbeddingRepository
from app.schemas.brand_profile import (
    BrandProfileCreate,
    BrandProfileList,
    BrandProfileRead,
    BrandProfileUpdate,
    VoiceMatchRequest,
    VoiceMatchResponse,
    VoiceSampleCreate,
    VoiceSampleRead,
)
from app.services.embeddings import generate_embedding
from app.services.voice_dna import compute_features, fit_profile, voice_match_score

router = APIRouter()


async def _get_profile_or_404(repo: BrandProfileRepository, profile_id: uuid.UUID) -> BrandProfile:
    profile = await repo.get_by_id(profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Brand profile not found")
    return profile


async def _refit(db: AsyncSession, profile: BrandProfile) -> BrandProfile:
    samples = await VoiceSampleRepository(db).list_for_profile(profile.id)
    texts = [s.text for s in samples]
    features, bigrams, total_words = fit_profile(texts)
    profile.style_features = features
    profile.bigram_signature = bigrams
    profile.sample_count = len(samples)
    profile.total_tokens = total_words
    await db.commit()
    await db.refresh(profile)

    # Refresh the voice embedding so neighbors search stays in sync.
    joined = "\n\n".join(t for t in texts if t and t.strip())
    if joined:
        result = await generate_embedding(joined)
        await EmbeddingRepository(db).upsert(
            entity_type="brand_profile",
            entity_id=profile.id,
            purpose="voice",
            model=result.model,
            vector=result.vector,
        )
    return profile


@router.get("", response_model=BrandProfileList)
async def list_profiles(db: AsyncSession = Depends(get_db)) -> BrandProfileList:
    items, total = await BrandProfileRepository(db).list_all()
    return BrandProfileList(
        items=[BrandProfileRead.model_validate(p) for p in items], total=total
    )


@router.post("", response_model=BrandProfileRead, status_code=status.HTTP_201_CREATED)
async def create_profile(
    payload: BrandProfileCreate,
    db: AsyncSession = Depends(get_db),
) -> BrandProfileRead:
    profile = BrandProfile(
        name=payload.name,
        description=payload.description,
        style_features={},
        bigram_signature={},
    )
    created = await BrandProfileRepository(db).create(profile)
    return BrandProfileRead.model_validate(created)


@router.get("/{profile_id}", response_model=BrandProfileRead)
async def get_profile(
    profile_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> BrandProfileRead:
    repo = BrandProfileRepository(db)
    profile = await _get_profile_or_404(repo, profile_id)
    return BrandProfileRead.model_validate(profile)


@router.patch("/{profile_id}", response_model=BrandProfileRead)
async def update_profile(
    profile_id: uuid.UUID,
    payload: BrandProfileUpdate,
    db: AsyncSession = Depends(get_db),
) -> BrandProfileRead:
    repo = BrandProfileRepository(db)
    profile = await _get_profile_or_404(repo, profile_id)
    updated = await repo.update(profile, **payload.model_dump(exclude_unset=True))
    return BrandProfileRead.model_validate(updated)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    repo = BrandProfileRepository(db)
    profile = await _get_profile_or_404(repo, profile_id)
    await repo.delete(profile)


@router.get("/{profile_id}/samples", response_model=list[VoiceSampleRead])
async def list_samples(
    profile_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[VoiceSampleRead]:
    await _get_profile_or_404(BrandProfileRepository(db), profile_id)
    samples = await VoiceSampleRepository(db).list_for_profile(profile_id)
    return [VoiceSampleRead.model_validate(s) for s in samples]


@router.post(
    "/{profile_id}/samples",
    response_model=BrandProfileRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_sample(
    profile_id: uuid.UUID,
    payload: VoiceSampleCreate,
    db: AsyncSession = Depends(get_db),
) -> BrandProfileRead:
    repo = BrandProfileRepository(db)
    profile = await _get_profile_or_404(repo, profile_id)
    sample = VoiceSample(
        brand_profile_id=profile.id,
        label=payload.label,
        source_url=payload.source_url,
        text=payload.text,
        word_count=count_words(payload.text),
    )
    await VoiceSampleRepository(db).create(sample)
    refit = await _refit(db, profile)
    return BrandProfileRead.model_validate(refit)


@router.post("/{profile_id}/fit", response_model=BrandProfileRead)
async def refit_profile(
    profile_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> BrandProfileRead:
    profile = await _get_profile_or_404(BrandProfileRepository(db), profile_id)
    refit = await _refit(db, profile)
    return BrandProfileRead.model_validate(refit)


@router.post("/{profile_id}/voice-match", response_model=VoiceMatchResponse)
async def voice_match(
    profile_id: uuid.UUID,
    payload: VoiceMatchRequest,
    db: AsyncSession = Depends(get_db),
) -> VoiceMatchResponse:
    profile = await _get_profile_or_404(BrandProfileRepository(db), profile_id)
    sample_features = compute_features(payload.text)
    score = voice_match_score(
        sample_features,
        {},  # bigram comparison skipped for short inputs to avoid noise
        profile.style_features,
        profile.bigram_signature,
    )
    return VoiceMatchResponse(score=score, sample_features=sample_features)
