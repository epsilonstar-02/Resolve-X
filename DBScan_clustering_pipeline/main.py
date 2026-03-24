"""Standalone DBSCAN clustering microservice.

Run locally:
    uv run --with uvicorn uvicorn DBScan_clustering_pipeline.main:app --reload --port 8010

Environment:
    DATABASE_URL=postgresql://user:password@host:5432/dbname
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any

import asyncpg
from fastapi import Depends, FastAPI, HTTPException, Request, status

try:
    from .schemas import ClusterFeatureCollection
    from .services import get_cluster_feature_collection
except ImportError:  # pragma: no cover
    from schemas import ClusterFeatureCollection
    from services import get_cluster_feature_collection

logger = logging.getLogger(__name__)
from dotenv import load_dotenv
load_dotenv()


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        logger.warning("Invalid int for %s=%r. Falling back to %d.", name, value, default)
        return default


APP_TITLE = os.getenv("APP_TITLE", "ResolveX DBSCAN Clustering Service")
APP_VERSION = os.getenv("APP_VERSION", "1.0.0")
APP_DESCRIPTION = os.getenv(
    "APP_DESCRIPTION",
    "Standalone microservice that exposes spatial complaint clustering as GeoJSON FeatureCollection.",
)
SERVICE_NAME = os.getenv("SERVICE_NAME", "dbscan-clustering")
DB_POOL_MIN_SIZE = _env_int("DB_POOL_MIN_SIZE", 1)
DB_POOL_MAX_SIZE = _env_int("DB_POOL_MAX_SIZE", 10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create and dispose the asyncpg pool for this microservice."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Set DATABASE_URL before starting the service."
        )

    app.state.db_pool = await asyncpg.create_pool(
        database_url,
        min_size=DB_POOL_MIN_SIZE,
        max_size=DB_POOL_MAX_SIZE,
    )
    logger.info("DB pool initialized for clustering microservice.")
    try:
        yield
    finally:
        pool = getattr(app.state, "db_pool", None)
        if pool is not None:
            await pool.close()
            logger.info("DB pool closed.")


app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
    lifespan=lifespan,
)


async def get_db_pool(request: Request) -> Any:
    """Resolve the asyncpg pool from app state."""
    return request.app.state.db_pool


@app.get("/healthz", tags=["Infrastructure"])
async def healthz() -> dict[str, str]:
    return {"status": "ok", "service": SERVICE_NAME}


@app.get(
    "/api/v1/analytics/clusters",
    response_model=ClusterFeatureCollection,
    summary="Spatial complaint clusters (GeoJSON FeatureCollection)",
    tags=["Analytics"],
)
async def get_clusters(
    pool: Any = Depends(get_db_pool),
) -> ClusterFeatureCollection:
    """Return DBSCAN clusters over trusted complaints."""
    try:
        return await get_cluster_feature_collection(pool)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Clustering pipeline failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The clustering service is temporarily unavailable.",
        ) from exc
