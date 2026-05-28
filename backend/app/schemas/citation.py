import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CitationBase(BaseModel):
    claim: str = Field(min_length=1)
    source_url: str = Field(min_length=1, max_length=2000)
    source_title: Optional[str] = Field(default=None, max_length=500)
    source_snippet: Optional[str] = None
    paragraph_index: Optional[int] = Field(default=None, ge=0)


class CitationCreate(CitationBase):
    pass


class CitationUpdate(BaseModel):
    claim: Optional[str] = None
    source_url: Optional[str] = Field(default=None, max_length=2000)
    source_title: Optional[str] = Field(default=None, max_length=500)
    source_snippet: Optional[str] = None
    paragraph_index: Optional[int] = Field(default=None, ge=0)
    verified: Optional[bool] = None


class CitationRead(CitationBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID
    verified: bool
    created_at: datetime
    updated_at: datetime
