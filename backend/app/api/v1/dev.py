"""Demo seed / clear endpoints (REMOVE ALONGSIDE `services/seed_data.py`).

The landing page's "Demo data" controls call into here. The whole demo surface
is two files plus one router line in `app/api/main.py` — delete those three
touch-points and nothing else changes.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services import seed_data

router = APIRouter()


@router.get("/status")
async def demo_status(db: AsyncSession = Depends(get_db)):
    counts = await seed_data.status(db)
    return {"counts": counts, "is_empty": all(v == 0 for v in counts.values())}


@router.post("/seed")
async def demo_seed(db: AsyncSession = Depends(get_db)):
    counts = await seed_data.seed(db)
    return {"counts": counts, "is_empty": False, "message": "Demo data loaded."}


@router.post("/clear")
async def demo_clear(db: AsyncSession = Depends(get_db)):
    deleted = await seed_data.clear_all(db)
    counts = await seed_data.status(db)
    return {
        "deleted": deleted,
        "counts": counts,
        "is_empty": True,
        "message": "All app data cleared.",
    }
