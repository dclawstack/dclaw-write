import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.draft_pipeline import DraftPipeline
from app.repositories.brand_profile_repo import BrandProfileRepository
from app.repositories.document_repo import DocumentRepository
from app.repositories.pipeline_repo import DraftPipelineRepository
from app.schemas.pipeline import PipelineList, PipelineRead, PipelineRunRequest
from app.services.ai import get_ai_client
from app.services.pipeline import run_pipeline

router = APIRouter()


@router.post("", response_model=PipelineRead, status_code=status.HTTP_201_CREATED)
async def start_pipeline(
    payload: PipelineRunRequest,
    db: AsyncSession = Depends(get_db),
) -> PipelineRead:
    if payload.document_id is not None:
        doc = await DocumentRepository(db).get_by_id(payload.document_id)
        if doc is None:
            raise HTTPException(status_code=404, detail="Document not found")

    profile = None
    if payload.brand_profile_id is not None:
        profile = await BrandProfileRepository(db).get_by_id(payload.brand_profile_id)
        if profile is None:
            raise HTTPException(status_code=404, detail="Brand profile not found")

    pipeline_repo = DraftPipelineRepository(db)
    run = DraftPipeline(
        document_id=payload.document_id,
        brand_profile_id=payload.brand_profile_id,
        topic=payload.topic,
        instruction=payload.instruction,
        status="running",
        artifacts={},
    )
    await pipeline_repo.create(run)

    style_features = profile.style_features if profile else {}
    bigram_signature = profile.bigram_signature if profile else {}

    client = get_ai_client()
    try:
        result = await run_pipeline(
            client=client,
            topic=payload.topic,
            instruction=payload.instruction,
            style_features=style_features,
            bigram_signature=bigram_signature,
        )
    except Exception as exc:  # pragma: no cover - defensive
        run.status = "failed"
        run.error = str(exc)
        await pipeline_repo.update(run, status="failed", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    run.status = "completed"
    run.current_step = "fact_checker"
    run.artifacts = result["artifacts"]
    run.final_draft = result["final_draft"]
    artifacts = dict(result["artifacts"])
    artifacts["voice_match_score"] = result["voice_match_score"]
    artifacts["duration_ms"] = result["duration_ms"]
    await pipeline_repo.update(
        run,
        status="completed",
        current_step="fact_checker",
        artifacts=artifacts,
        final_draft=result["final_draft"],
    )

    return PipelineRead.model_validate(run)


@router.get("", response_model=PipelineList)
async def list_pipelines(db: AsyncSession = Depends(get_db)) -> PipelineList:
    items, total = await DraftPipelineRepository(db).list_all()
    return PipelineList(
        items=[PipelineRead.model_validate(p) for p in items], total=total
    )


@router.get("/{pipeline_id}", response_model=PipelineRead)
async def get_pipeline(
    pipeline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> PipelineRead:
    run = await DraftPipelineRepository(db).get_by_id(pipeline_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    return PipelineRead.model_validate(run)
