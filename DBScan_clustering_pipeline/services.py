"""
services.py — RX-021: DBSCAN Spatial Clustering
Urban Intelligence Engine — core analytics logic.

Pipeline:
  1. Trust-gated PostGIS query (last 30 days, officer_verified OR trust_weight > 0.60)
  2. Coordinate array → radians conversion for Haversine metric
  3. DBSCAN via sklearn (eps = 500 m radius, min_samples = 3)
  4. Convex Hull polygon per cluster (fallback: MultiPoint for collinear triplets)
  5. Returns a validated ClusterFeatureCollection

References:
  - RX-021 (DBSCAN spatial clustering pipeline)
  - PRD trust architecture: "DBSCAN runs only on verified + high-reputation data"
  - RFC 7946: GeoJSON specification
"""

from __future__ import annotations

import logging
import os
from collections import Counter
from typing import Any

import numpy as np
from scipy.spatial import ConvexHull, QhullError
from sklearn.cluster import DBSCAN

try:
    from .schemas import (
        ClusterFeature,
        ClusterFeatureCollection,
        ClusterProperties,
        MultiPointGeometry,
        PolygonGeometry,
    )
except ImportError:  # pragma: no cover
    from schemas import (
        ClusterFeature,
        ClusterFeatureCollection,
        ClusterProperties,
        MultiPointGeometry,
        PolygonGeometry,
    )

logger = logging.getLogger(__name__)
from dotenv import load_dotenv
load_dotenv()


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        logger.warning("Invalid int for %s=%r. Falling back to %d.", name, value, default)
        return default


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        logger.warning("Invalid float for %s=%r. Falling back to %.3f.", name, value, default)
        return default

# Minimum number of complaints before we attempt any clustering.
# DBSCAN itself requires min_samples=3, but we gate early to avoid
# unnecessary DB round-trips and NumPy allocations.
MIN_COMPLAINTS_REQUIRED: int = _env_int("MIN_COMPLAINTS_REQUIRED", 3)

# Rolling complaint window in days.
LOOKBACK_DAYS: int = _env_int("LOOKBACK_DAYS", 30)

# DBSCAN parameters (Haversine / ball_tree)
# eps = 500 m expressed as arc-length on a unit sphere (r = 6371 km).
EARTH_RADIUS_KM: float = _env_float("EARTH_RADIUS_KM", 6371.0)
SEARCH_RADIUS_KM: float = _env_float("SEARCH_RADIUS_KM", 0.5)
DBSCAN_EPS: float = SEARCH_RADIUS_KM / EARTH_RADIUS_KM
DBSCAN_MIN_SAMPLES: int = _env_int("DBSCAN_MIN_SAMPLES", 3)

# Trust-gate SQL thresholds (mirrors PRODUCTION_CREDIBILITY_PLAN)
TRUST_WEIGHT_THRESHOLD: float = _env_float("TRUST_WEIGHT_THRESHOLD", 0.60)


# ---------------------------------------------------------------------------
# SQL
# ---------------------------------------------------------------------------

# Raw asyncpg query — returns one row per trusted complaint filed in the
# last 30 days.  The trust gate replicates the three-layer credibility
# system described in the PRD:
#   • officer_verified = true  → field-confirmed by a municipal officer
#   • trust_weight > 0.60      → high-reputation citizen submission
#
# ST_Y / ST_X extract latitude / longitude from the PostGIS GEOMETRY column
# (SRID 4326, i.e. WGS-84 degrees).
_FETCH_TRUSTED_COMPLAINTS_SQL = """
    SELECT
        id AS complaint_id,
        category,
        ward_id,
        ST_Y(location::geometry)  AS latitude,
        ST_X(location::geometry)  AS longitude
    FROM
        complaints
    WHERE
        created_at  >= NOW() - ($2::int * INTERVAL '1 day')
        AND (
            officer_verified = TRUE
            OR trust_weight  > $1
        )
    ORDER BY
        created_at DESC;
"""


# ---------------------------------------------------------------------------
# Database layer
# ---------------------------------------------------------------------------


async def fetch_trusted_complaints(pool: Any) -> list[dict[str, Any]]:
    """Execute the trust-gated query and return raw rows as dicts.

    Args:
        pool: asyncpg connection pool (injected via ``Depends(get_db_pool)``).

    Returns:
        List of dicts with keys: complaint_id, category, latitude, longitude.
        Returns an empty list if the pool returns no rows.
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            _FETCH_TRUSTED_COMPLAINTS_SQL,
            TRUST_WEIGHT_THRESHOLD,
            LOOKBACK_DAYS,
        )

    # asyncpg returns asyncpg.Record objects; convert to plain dicts for
    # downstream Pandas/NumPy interoperability.
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Clustering pipeline
# ---------------------------------------------------------------------------


def run_dbscan(coords_rad: np.ndarray) -> np.ndarray:
    """Run DBSCAN on a (N, 2) array of [lat_rad, lon_rad] coordinates.

    Using ``metric='haversine'`` with ``algorithm='ball_tree'`` is the
    sklearn-recommended combination for geodesic nearest-neighbour search.
    ``eps`` is expressed as an arc-length on a unit sphere so that it
    corresponds directly to the 500 m ground distance.

    Args:
        coords_rad: Shape (N, 2) — [[lat_rad, lon_rad], ...].

    Returns:
        1-D integer array of cluster labels (length N).
        Label -1 denotes noise / unclustered points.
    """
    db = DBSCAN(
        eps=DBSCAN_EPS,
        min_samples=DBSCAN_MIN_SAMPLES,
        algorithm="ball_tree",
        metric="haversine",
    )
    return db.fit_predict(coords_rad)


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------


def _build_polygon(coords_deg: np.ndarray) -> PolygonGeometry:
    """Compute ConvexHull and return a closed GeoJSON Polygon ring.

    Coordinates are stored as [longitude, latitude] per RFC 7946 §3.1.1.
    The ring is explicitly closed (first position == last position).

    Args:
        coords_deg: Shape (M, 2) — [[lat_deg, lon_deg], ...] for M points
                    belonging to one cluster.

    Returns:
        PolygonGeometry with a single exterior ring.

    Raises:
        QhullError: propagated to the caller when points are collinear.
    """
    hull = ConvexHull(coords_deg)  # may raise QhullError

    # hull.vertices gives the indices of hull vertices in CCW order.
    hull_pts = coords_deg[hull.vertices]

    # Swap to [lon, lat] and close the ring.
    ring: list[list[float]] = [
        [float(lon), float(lat)] for lat, lon in hull_pts
    ]
    ring.append(ring[0])  # close the ring

    return PolygonGeometry(coordinates=[ring])


def _build_multipoint(coords_deg: np.ndarray) -> MultiPointGeometry:
    """Fallback: return all cluster points as a GeoJSON MultiPoint.

    Used when ConvexHull raises QhullError (e.g. exactly 3 collinear points).

    Args:
        coords_deg: Shape (M, 2) — [[lat_deg, lon_deg], ...].

    Returns:
        MultiPointGeometry with one position per complaint.
    """
    positions = [[float(lon), float(lat)] for lat, lon in coords_deg]
    return MultiPointGeometry(coordinates=positions)


# ---------------------------------------------------------------------------
# Feature builder
# ---------------------------------------------------------------------------


def _build_feature(
    cluster_id: int,
    coords_deg: np.ndarray,
    categories: list[str],
    ward_ids: list[str],
) -> ClusterFeature:
    """Build a single GeoJSON Feature for one DBSCAN cluster.

    Attempts to generate a ConvexHull Polygon; falls back to MultiPoint
    for degenerate (collinear) point sets.

    Args:
        cluster_id:  DBSCAN label for this cluster (≥ 0).
        coords_deg:  All complaint coordinates in the cluster [[lat, lon], ...].
        categories:  Complaint category string per point (same order as coords).
        ward_ids:    Ward ID string per point (same order as coords).

    Returns:
        ClusterFeature ready for serialisation.
    """
    # --- primary category: modal value --------------------------------------
    most_common_category, _ = Counter(categories).most_common(1)[0]

    # --- primary ward_id: modal value ---------------------------------------
    valid_wards = [w for w in ward_ids if w]
    most_common_ward = Counter(valid_wards).most_common(1)[0][0] if valid_wards else "Unknown"

    # --- geometry -----------------------------------------------------------
    try:
        geometry = _build_polygon(coords_deg)
    except QhullError:
        # Collinear / near-duplicate points — ConvexHull is undefined.
        logger.warning(
            "Cluster %d: ConvexHull failed (collinear points). "
            "Falling back to MultiPoint geometry.",
            cluster_id,
        )
        geometry = _build_multipoint(coords_deg)

    return ClusterFeature(
        geometry=geometry,
        properties=ClusterProperties(
            cluster_id=cluster_id,
            complaint_count=len(categories),
            primary_category=most_common_category,
            ward_id=most_common_ward,
        ),
    )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


async def get_cluster_feature_collection(
    pool: Any,
) -> ClusterFeatureCollection:
    """Full clustering pipeline — the single callable used by the router.

    Steps:
      1. Fetch trust-gated complaints from PostGIS.
      2. Early-exit with empty FeatureCollection if < MIN_COMPLAINTS_REQUIRED.
      3. Build coordinate array and convert degrees → radians.
      4. Run DBSCAN (Haversine / ball_tree).
      5. For each valid cluster label (≠ -1) build a polygon Feature.
      6. Return the assembled FeatureCollection.

    Args:
        pool: asyncpg connection pool.

    Returns:
        ClusterFeatureCollection — always a valid GeoJSON object.
    """
    # ------------------------------------------------------------------
    # 1. Data fetch
    # ------------------------------------------------------------------
    rows = await fetch_trusted_complaints(pool)
    logger.info("Trust-gated query returned %d complaints.", len(rows))

    # ------------------------------------------------------------------
    # 2. Edge-case: insufficient data
    # ------------------------------------------------------------------
    if len(rows) < MIN_COMPLAINTS_REQUIRED:
        logger.info(
            "Fewer than %d trusted complaints found in the last 30 days. "
            "Returning empty FeatureCollection.",
            MIN_COMPLAINTS_REQUIRED,
        )
        return ClusterFeatureCollection()

    # ------------------------------------------------------------------
    # 3. Build arrays
    # ------------------------------------------------------------------
    # coords_deg shape: (N, 2) — [[lat, lon], ...] in degrees
    coords_deg = np.array(
        [[row["latitude"], row["longitude"]] for row in rows],
        dtype=np.float64,
    )
    categories: list[str] = [row["category"] for row in rows]
    ward_ids: list[str] = [row.get("ward_id", "") or "" for row in rows]

    # DBSCAN with haversine requires radians
    coords_rad = np.radians(coords_deg)

    # ------------------------------------------------------------------
    # 4. DBSCAN
    # ------------------------------------------------------------------
    labels = run_dbscan(coords_rad)

    unique_labels = set(labels)
    cluster_labels = unique_labels - {-1}  # exclude noise
    logger.info(
        "DBSCAN produced %d cluster(s); %d noise point(s).",
        len(cluster_labels),
        int(np.sum(labels == -1)),
    )

    if not cluster_labels:
        logger.info("No clusters formed — all points classified as noise.")
        return ClusterFeatureCollection()

    # ------------------------------------------------------------------
    # 5. Build Features
    # ------------------------------------------------------------------
    features: list[ClusterFeature] = []

    for label in sorted(cluster_labels):
        mask = labels == label
        cluster_coords = coords_deg[mask]          # degrees, shape (M, 2)
        cluster_categories = [
            cat for cat, m in zip(categories, mask) if m
        ]
        cluster_ward_ids = [
            wid for wid, m in zip(ward_ids, mask) if m
        ]

        feature = _build_feature(
            cluster_id=int(label),
            coords_deg=cluster_coords,
            categories=cluster_categories,
            ward_ids=cluster_ward_ids,
        )
        features.append(feature)

    # ------------------------------------------------------------------
    # 6. Assemble FeatureCollection
    # ------------------------------------------------------------------
    return ClusterFeatureCollection(features=features)
