import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CompletionRequest(BaseModel):
    document_id: Optional[uuid.UUID] = None
    brand_profile_id: Optional[uuid.UUID] = None
    prompt: str = Field(min_length=1)
    instruction: Optional[str] = None
    max_tokens: int = Field(default=300, ge=16, le=2048)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)


class CompletionResponse(BaseModel):
    suggestion_id: uuid.UUID
    text: str
    provider: str
    model: str
    latency_ms: int
    voice_match_score: Optional[int] = None


class SuggestionFeedback(BaseModel):
    accepted: bool


class SuggestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: Optional[uuid.UUID]
    brand_profile_id: Optional[uuid.UUID]
    prompt: str
    output: str
    model: str
    provider: str
    latency_ms: int
    voice_match_score: Optional[int]
    accepted: Optional[bool]
    created_at: datetime
    resolved_at: Optional[datetime]


class ReadabilityRequest(BaseModel):
    text: str


class ReadabilityResponse(BaseModel):
    flesch_reading_ease: float
    flesch_kincaid_grade: float
    sentences: int
    words: int
    syllables: int
    mean_sentence_length: float
    long_sentence_ratio: float
