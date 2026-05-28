import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class PipelineRunRequest(BaseModel):
    topic: str = Field(min_length=1)
    document_id: Optional[uuid.UUID] = None
    brand_profile_id: Optional[uuid.UUID] = None
    instruction: Optional[str] = None


class PipelineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: Optional[uuid.UUID]
    brand_profile_id: Optional[uuid.UUID]
    topic: str
    instruction: Optional[str]
    status: str
    current_step: Optional[str]
    artifacts: dict[str, Any]
    final_draft: str
    error: Optional[str]
    created_at: datetime
    updated_at: datetime


class PipelineList(BaseModel):
    items: list[PipelineRead]
    total: int


class EvalRequest(BaseModel):
    brand_profile_id: Optional[uuid.UUID] = None


class EvalResponse(BaseModel):
    word_count: int
    voice_match_score: Optional[int]
    readability: dict[str, float]
    citation_density: float
    verified_citation_ratio: float
    total_citations: int
    verified_citations: int
    claims_needing_sources: int
    grade: str
