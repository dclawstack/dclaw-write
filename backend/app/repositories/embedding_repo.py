import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.embedding import Embedding
from app.repositories.base_repo import BaseRepository


class EmbeddingRepository(BaseRepository[Embedding]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, Embedding)

    async def get_for_entity(
        self,
        entity_type: str,
        entity_id: uuid.UUID,
        purpose: str = "semantic",
    ) -> Optional[Embedding]:
        stmt = select(Embedding).where(
            Embedding.entity_type == entity_type,
            Embedding.entity_id == entity_id,
            Embedding.purpose == purpose,
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def upsert(
        self,
        *,
        entity_type: str,
        entity_id: uuid.UUID,
        purpose: str,
        model: str,
        vector: list[float],
    ) -> Embedding:
        existing = await self.get_for_entity(entity_type, entity_id, purpose)
        if existing is not None:
            existing.model = model
            existing.dim = len(vector)
            existing.vector = vector
            await self.db.commit()
            await self.db.refresh(existing)
            return existing
        row = Embedding(
            entity_type=entity_type,
            entity_id=entity_id,
            purpose=purpose,
            model=model,
            dim=len(vector),
            vector=vector,
        )
        return await self.create(row)

    async def list_by_type(
        self,
        entity_type: str,
        purpose: str = "semantic",
    ) -> list[Embedding]:
        stmt = select(Embedding).where(
            Embedding.entity_type == entity_type,
            Embedding.purpose == purpose,
        )
        return list((await self.db.execute(stmt)).scalars().all())
