import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class BrandProfileBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None


class BrandProfileCreate(BrandProfileBase):
    pass


class BrandProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None


class BrandProfileRead(BrandProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sample_count: int
    total_tokens: int
    style_features: dict[str, Any]
    bigram_signature: dict[str, float]
    created_at: datetime
    updated_at: datetime


class BrandProfileList(BaseModel):
    items: list[BrandProfileRead]
    total: int


class VoiceSampleCreate(BaseModel):
    text: str = Field(min_length=1)
    label: Optional[str] = Field(default=None, max_length=200)
    source_url: Optional[str] = Field(default=None, max_length=1000)


class VoiceSampleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    brand_profile_id: uuid.UUID
    label: Optional[str]
    source_url: Optional[str]
    word_count: int
    created_at: datetime


class VoiceMatchRequest(BaseModel):
    text: str = Field(min_length=1)


class VoiceMatchResponse(BaseModel):
    score: int  # 0..100
    sample_features: dict[str, float]
