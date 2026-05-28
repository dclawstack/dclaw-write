import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import JSON, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utc_now
from app.models.base import Base


class DraftPipeline(Base):
    """One run of the planner → researcher → drafter → editor → fact-checker pipeline.

    Each step persists its artifact under ``artifacts[step]`` so the user can
    inspect intermediate state or re-run a single step (complexity-2 follow-up).
    """

    __tablename__ = "draft_pipelines"

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

    topic: Mapped[str] = mapped_column(Text, nullable=False)
    instruction: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    current_step: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    artifacts: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    final_draft: Mapped[str] = mapped_column(Text, nullable=False, default="")
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now, nullable=False)
