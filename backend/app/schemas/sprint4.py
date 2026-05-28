from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


# ----- AI detection ---------------------------------------------------------


class DetectionRequest(BaseModel):
    text: str = Field(min_length=1)


class DetectionResponse(BaseModel):
    score: int
    label: str
    burstiness: int
    lexical_diversity: int
    punctuation_variety: int
    starter_diversity: int
    rare_word_share: int
    suggestions: list[str]


# ----- Headlines ------------------------------------------------------------


class HeadlinesRequest(BaseModel):
    topic: str = Field(min_length=1)
    body: str = ""
    n: int = Field(default=5, ge=2, le=10)
    brand_profile_id: Optional[str] = None  # string UUID, validated downstream


class HeadlineVariant(BaseModel):
    headline: str
    score: int
    length_score: int
    specificity_score: int
    curiosity_score: int
    voice_match_score: int
    provider: str
    model: str


class HeadlinesResponse(BaseModel):
    variants: list[HeadlineVariant]


# ----- Translate + cultural review ------------------------------------------


class TranslationRequest(BaseModel):
    text: str = Field(min_length=1)
    target_language: str = Field(min_length=2, max_length=10)
    brand_profile_id: Optional[str] = None


class CulturalFinding(BaseModel):
    match: str
    category: str
    suggestion: str
    position: str


class TranslationResponse(BaseModel):
    target_language: str
    language_name: str
    text: str
    provider: str
    model: str
    latency_ms: int
    cultural_review: list[CulturalFinding]


class LanguageOption(BaseModel):
    code: str
    name: str


# ----- Analytics ------------------------------------------------------------


class ProviderRow(BaseModel):
    provider: str
    completions: int
    avg_latency_ms: int
    p95_latency_ms: int
    avg_voice_match: Optional[int] = None
    estimated_cost_cents: float


class RecentSuggestion(BaseModel):
    created_at: str
    provider: str
    model: str
    latency_ms: int
    voice_match_score: Optional[int]
    accepted: Optional[bool]


class DashboardResponse(BaseModel):
    total_completions: int
    accepted: int
    rejected: int
    pending: int
    accept_rate: Optional[float] = None
    avg_latency_ms: int
    p95_latency_ms: int
    avg_voice_match: Optional[int] = None
    estimated_cost_cents: float
    providers: list[ProviderRow]
    recent: list[RecentSuggestion]
