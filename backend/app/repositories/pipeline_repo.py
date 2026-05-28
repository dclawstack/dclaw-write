from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.draft_pipeline import DraftPipeline
from app.repositories.base_repo import BaseRepository


class DraftPipelineRepository(BaseRepository[DraftPipeline]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, DraftPipeline)

    async def list_all(self, limit: int = 25, offset: int = 0):
        stmt = (
            select(DraftPipeline)
            .order_by(DraftPipeline.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        items = list((await self.db.execute(stmt)).scalars().all())
        total = await self.count()
        return items, total

    async def update(self, run: DraftPipeline, **fields) -> DraftPipeline:
        for key, value in fields.items():
            setattr(run, key, value)
        await self.db.commit()
        await self.db.refresh(run)
        return run
