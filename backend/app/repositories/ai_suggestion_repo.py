import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_suggestion import AISuggestion
from app.repositories.base_repo import BaseRepository


class AISuggestionRepository(BaseRepository[AISuggestion]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, AISuggestion)

    async def list_for_document(self, document_id: uuid.UUID) -> list[AISuggestion]:
        stmt = (
            select(AISuggestion)
            .where(AISuggestion.document_id == document_id)
            .order_by(AISuggestion.created_at.desc())
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def update(self, suggestion: AISuggestion, **fields) -> AISuggestion:
        for key, value in fields.items():
            if value is not None:
                setattr(suggestion, key, value)
        await self.db.commit()
        await self.db.refresh(suggestion)
        return suggestion
