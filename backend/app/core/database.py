from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.config import settings
from app.models.base import Base

_is_sqlite = settings.database_url.startswith("sqlite")

engine = create_async_engine(
    settings.database_url,
    echo=settings.app_env == "dev",
    pool_pre_ping=not _is_sqlite,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)


async def get_db() -> AsyncSession:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    # Ensure model modules register their tables on Base.metadata.
    from app.models import (  # noqa: F401
        ai_suggestion,
        brand_profile,
        citation,
        document,
        draft_pipeline,
        embedding,
        project,
        revision,
        voice_sample,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
