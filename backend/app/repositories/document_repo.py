import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.revision import Revision
from app.repositories.base_repo import BaseRepository


class DocumentRepository(BaseRepository[Document]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, Document)

    async def list_by_project(
        self,
        project_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Document], int]:
        stmt = (
            select(Document)
            .where(Document.project_id == project_id)
            .order_by(Document.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        items = list(result.scalars().all())

        count_stmt = (
            select(func.count())
            .select_from(Document)
            .where(Document.project_id == project_id)
        )
        total = (await self.db.execute(count_stmt)).scalar() or 0
        return items, total

    async def list_all(self, limit: int = 50, offset: int = 0) -> tuple[list[Document], int]:
        stmt = (
            select(Document)
            .order_by(Document.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        items = list(result.scalars().all())
        total = await self.count()
        return items, total

    async def update(self, document: Document, **fields) -> Document:
        for key, value in fields.items():
            if value is not None:
                setattr(document, key, value)
        await self.db.commit()
        await self.db.refresh(document)
        return document


class RevisionRepository(BaseRepository[Revision]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, Revision)

    async def list_for_document(
        self,
        document_id: uuid.UUID,
        limit: int = 25,
    ) -> list[Revision]:
        stmt = (
            select(Revision)
            .where(Revision.document_id == document_id)
            .order_by(Revision.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
