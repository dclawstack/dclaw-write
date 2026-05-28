import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import JSON, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.utils import utc_now
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.voice_sample import VoiceSample


class BrandProfile(Base):
    __tablename__ = "brand_profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Voice DNA artifacts. Kept as JSON so SQLite/Postgres both work and the
    # shape can evolve without migrations until pgvector lands in complexity-2.
    style_features: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    bigram_signature: Mapped[dict[str, float]] = mapped_column(JSON, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now, nullable=False)

    samples: Mapped[list["VoiceSample"]] = relationship(
        back_populates="brand_profile",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
