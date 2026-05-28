import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class WebSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    max_results: int = Field(default=5, ge=1, le=10)


class WebSearchResult(BaseModel):
    title: str
    url: str
    snippet: str
    provider: str


class WebSearchResponse(BaseModel):
    query: str
    results: list[WebSearchResult]


class GroundRequest(BaseModel):
    claim: str = Field(min_length=1)
    max_results: int = Field(default=5, ge=1, le=10)
    accept_threshold: int = Field(default=50, ge=0, le=100)


class GroundedSourceRead(BaseModel):
    title: str
    url: str
    snippet: str
    provider: str
    support_score: int
    verified: bool


class GroundResponse(BaseModel):
    claim: str
    sources: list[GroundedSourceRead]


class AutoGroundRequest(BaseModel):
    accept_threshold: int = Field(default=50, ge=0, le=100)
    max_claims: int = Field(default=8, ge=1, le=25)


class AutoGroundResponse(BaseModel):
    document_id: uuid.UUID
    created_citation_ids: list[uuid.UUID]
    skipped_sentences: int


class SemanticSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    k: int = Field(default=5, ge=1, le=20)


class SemanticSearchHit(BaseModel):
    document_id: uuid.UUID
    title: str
    score: float


class SemanticSearchResponse(BaseModel):
    results: list[SemanticSearchHit]


class RepurposeRequest(BaseModel):
    platform: str
    brand_profile_id: Optional[uuid.UUID] = None
    instruction: Optional[str] = None


class RepurposeResponse(BaseModel):
    platform: str
    platform_name: str
    text: str
    provider: str
    model: str
    latency_ms: int


class VoiceNeighbor(BaseModel):
    brand_profile_id: uuid.UUID
    name: str
    similarity: float


class VoiceNeighborsResponse(BaseModel):
    profile_id: uuid.UUID
    neighbors: list[VoiceNeighbor]


class EmbeddingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    entity_type: str
    entity_id: uuid.UUID
    purpose: str
    model: str
    dim: int


class PlatformInfo(BaseModel):
    key: str
    name: str
