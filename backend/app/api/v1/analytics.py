from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.sprint4 import DashboardResponse
from app.services.analytics import dashboard

router = APIRouter()


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(db: AsyncSession = Depends(get_db)) -> DashboardResponse:
    return DashboardResponse(**(await dashboard(db)))
