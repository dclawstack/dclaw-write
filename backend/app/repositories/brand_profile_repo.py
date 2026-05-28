import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand_profile import BrandProfile
from app.models.voice_sample import VoiceSample
from app.repositories.base_repo import BaseRepository


class BrandProfileRepository(BaseRepository[BrandProfile]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, BrandProfile)

    async def list_all(self, limit: int = 50, offset: int = 0):
        stmt = (
            select(BrandProfile)
            .order_by(BrandProfile.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        items = list((await self.db.execute(stmt)).scalars().all())
        total = await self.count()
        return items, total

    async def update(self, profile: BrandProfile, **fields) -> BrandProfile:
        for key, value in fields.items():
            if value is not None:
                setattr(profile, key, value)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile


class VoiceSampleRepository(BaseRepository[VoiceSample]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, VoiceSample)

    async def list_for_profile(self, brand_profile_id: uuid.UUID) -> list[VoiceSample]:
        stmt = (
            select(VoiceSample)
            .where(VoiceSample.brand_profile_id == brand_profile_id)
            .order_by(VoiceSample.created_at.desc())
        )
        return list((await self.db.execute(stmt)).scalars().all())
