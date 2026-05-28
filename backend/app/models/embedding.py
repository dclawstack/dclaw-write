import uuid
from datetime import datetime

from sqlalchemy import JSON, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utc_now
from app.models.base import Base


class Embedding(Base):
    """Polymorphic embedding store.

    A single table backs vectors for documents, citations, voice samples, and
    brand profiles. The ``vector`` column is JSON for SQLite/Postgres parity;
    migration to pgvector keeps the same column shape (a fixed-length array)
    once the production DB enables the extension.
    """

    __tablename__ = "embeddings"
    __table_args__ = (
        UniqueConstraint(
            "entity_type", "entity_id", "purpose", name="uq_embedding_entity_purpose"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(String(40), nullable=False, default="semantic")
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    dim: Mapped[int] = mapped_column(Integer, nullable=False)
    vector: Mapped[list[float]] = mapped_column(JSON, nullable=False)

    created_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now, nullable=False)
