from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health
from app.api.v1 import (
    ai,
    analytics,
    brand_profiles,
    citations,
    collab,
    dev,  # demo seed/clear — remove when stripping the demo surface
    documents,
    pipeline,
    projects,
    search,
)
from app.core.config import settings
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(citations.router, prefix="/api/v1", tags=["citations"])
app.include_router(
    brand_profiles.router, prefix="/api/v1/brand-profiles", tags=["brand-profiles"]
)
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
app.include_router(pipeline.router, prefix="/api/v1/pipelines", tags=["pipelines"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(collab.router, prefix="/api/v1/collab")
app.include_router(dev.router, prefix="/api/v1/dev", tags=["dev"])  # demo seed/clear
