import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.project import Project
from app.repositories.project_repo import ProjectRepository
from app.schemas.project import (
    ProjectCreate,
    ProjectList,
    ProjectRead,
    ProjectUpdate,
)

router = APIRouter()


def _repo(db: AsyncSession) -> ProjectRepository:
    return ProjectRepository(db)


@router.get("", response_model=ProjectList)
async def list_projects(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> ProjectList:
    items, total = await _repo(db).list_all(limit=limit, offset=offset)
    return ProjectList(items=[ProjectRead.model_validate(i) for i in items], total=total)


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    project = Project(name=payload.name, description=payload.description)
    created = await _repo(db).create(project)
    return ProjectRead.model_validate(created)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    project = await _repo(db).get_by_id(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectRead.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
) -> ProjectRead:
    repo = _repo(db)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    updated = await repo.update(project, **payload.model_dump(exclude_unset=True))
    return ProjectRead.model_validate(updated)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    repo = _repo(db)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    await repo.delete(project)
