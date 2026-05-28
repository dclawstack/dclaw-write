import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.citation import Citation
from app.repositories.base_repo import BaseRepository


class CitationRepository(BaseRepository[Citation]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, Citation)

    async def list_for_document(self, document_id: uuid.UUID) -> list[Citation]:
        stmt = (
            select(Citation)
            .where(Citation.document_id == document_id)
            .order_by(Citation.paragraph_index.nulls_last(), Citation.created_at)
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def update(self, citation: Citation, **fields) -> Citation:
        for key, value in fields.items():
            if value is not None:
                setattr(citation, key, value)
        await self.db.commit()
        await self.db.refresh(citation)
        return citation
