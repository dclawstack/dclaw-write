import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utc_now
from app.models.base import Base


class AISuggestion(Base):
    """Telemetry for every Copilot completion — drives the data flywheel."""

    __tablename__ = "ai_suggestions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    brand_profile_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("brand_profiles.id", ondelete="SET NULL"),
        nullable=True,
    )

    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    output: Mapped[str] = mapped_column(Text, nullable=False)

    model: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    voice_match_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    accepted: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
