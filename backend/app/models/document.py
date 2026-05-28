import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.utils import utc_now
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.revision import Revision


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(300), nullable=False, default="Untitled")
    content_type: Mapped[str] = mapped_column(String(50), nullable=False, default="article")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")

    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reading_time_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now, nullable=False)

    project: Mapped["Project"] = relationship(back_populates="documents", lazy="selectin")
    revisions: Mapped[list["Revision"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="Revision.created_at.desc()",
    )
