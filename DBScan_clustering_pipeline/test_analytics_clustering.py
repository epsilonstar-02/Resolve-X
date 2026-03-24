"""
tests/test_analytics_clustering.py
RX-021 — DBSCAN Spatial Clustering: unit + integration tests.

Run with:
    pytest tests/test_analytics_clustering.py -v

Coverage targets:
  ✔ schemas  — valid Polygon, MultiPoint, empty collection
  ✔ services — trust-gated SQL parameter, edge cases (<3 pts, all noise,
                collinear QhullError fallback), full happy-path pipeline
    ✔ API app  — HTTP 200 happy-path, HTTP 200 empty collection, HTTP 503 on service error
"""

from __future__ import annotations

import math
from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient
from scipy.spatial import QhullError

# --------------------------------------------------------------------------
# Module under test
# --------------------------------------------------------------------------
from DBScan_clustering_pipeline.schemas import (
    ClusterFeature,
    ClusterFeatureCollection,
    ClusterProperties,
    MultiPointGeometry,
    PolygonGeometry,
)
from DBScan_clustering_pipeline.services import (
    DBSCAN_EPS,
    DBSCAN_MIN_SAMPLES,
    EARTH_RADIUS_KM,
    MIN_COMPLAINTS_REQUIRED,
    SEARCH_RADIUS_KM,
    TRUST_WEIGHT_THRESHOLD,
    _build_feature,
    _build_multipoint,
    _build_polygon,
    fetch_trusted_complaints,
    get_cluster_feature_collection,
    run_dbscan,
)
from DBScan_clustering_pipeline.main import app, get_db_pool


# ==========================================================================
# Fixtures & helpers
# ==========================================================================


def _make_pool(rows: list[dict]) -> Any:
    """Return a mock asyncpg pool that yields ``rows`` from conn.fetch()."""
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=rows)

    mock_pool = MagicMock()
    mock_pool.acquire = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=mock_conn),
            __aexit__=AsyncMock(return_value=False),
        )
    )
    return mock_pool


# Tight cluster of 5 complaints near Bharat Mandapam (~28.61°N, 77.21°E)
_CLUSTER_ROWS: list[dict] = [
    {"complaint_id": "c1", "category": "Drainage",    "latitude": 28.6100, "longitude": 77.2090},
    {"complaint_id": "c2", "category": "Drainage",    "latitude": 28.6105, "longitude": 77.2095},
    {"complaint_id": "c3", "category": "Drainage",    "latitude": 28.6110, "longitude": 77.2100},
    {"complaint_id": "c4", "category": "Road",        "latitude": 28.6098, "longitude": 77.2088},
    {"complaint_id": "c5", "category": "Drainage",    "latitude": 28.6103, "longitude": 77.2092},
]

# Perfectly collinear points (lat increases, lon fixed)
_COLLINEAR_ROWS: list[dict] = [
    {"complaint_id": "d1", "category": "Streetlight", "latitude": 28.610, "longitude": 77.210},
    {"complaint_id": "d2", "category": "Streetlight", "latitude": 28.611, "longitude": 77.210},
    {"complaint_id": "d3", "category": "Streetlight", "latitude": 28.612, "longitude": 77.210},
]


# ==========================================================================
# 1. Schema tests
# ==========================================================================


class TestSchemas:
    def test_polygon_geometry_type(self):
        ring = [[77.209, 28.610], [77.210, 28.612], [77.211, 28.609], [77.209, 28.610]]
        geom = PolygonGeometry(coordinates=[ring])
        assert geom.type == "Polygon"
        assert geom.coordinates[0][0] == geom.coordinates[0][-1], "Ring must be closed"

    def test_multipoint_geometry_type(self):
        geom = MultiPointGeometry(coordinates=[[77.21, 28.61], [77.22, 28.62]])
        assert geom.type == "MultiPoint"
        assert len(geom.coordinates) == 2

    def test_cluster_properties_validation(self):
        props = ClusterProperties(
            cluster_id=0, complaint_count=5, primary_category="Drainage"
        )
        assert props.cluster_id == 0
        assert props.complaint_count == 5

    def test_cluster_properties_rejects_negative_cluster_id(self):
        with pytest.raises(Exception):
            ClusterProperties(cluster_id=-1, complaint_count=3, primary_category="Road")

    def test_cluster_properties_rejects_zero_complaint_count(self):
        with pytest.raises(Exception):
            ClusterProperties(cluster_id=0, complaint_count=0, primary_category="Road")

    def test_empty_feature_collection(self):
        fc = ClusterFeatureCollection()
        assert fc.type == "FeatureCollection"
        assert fc.features == []

    def test_feature_collection_with_polygon_feature(self):
        ring = [[77.21, 28.61], [77.22, 28.62], [77.23, 28.60], [77.21, 28.61]]
        feature = ClusterFeature(
            geometry=PolygonGeometry(coordinates=[ring]),
            properties=ClusterProperties(
                cluster_id=0, complaint_count=3, primary_category="Drainage"
            ),
        )
        fc = ClusterFeatureCollection(features=[feature])
        assert len(fc.features) == 1
        assert fc.features[0].geometry.type == "Polygon"

    def test_feature_collection_with_multipoint_feature(self):
        feature = ClusterFeature(
            geometry=MultiPointGeometry(coordinates=[[77.21, 28.61], [77.22, 28.62]]),
            properties=ClusterProperties(
                cluster_id=1, complaint_count=2, primary_category="Road"
            ),
        )
        fc = ClusterFeatureCollection(features=[feature])
        assert fc.features[0].geometry.type == "MultiPoint"


# ==========================================================================
# 2. Constants
# ==========================================================================


class TestConstants:
    def test_eps_value(self):
        expected = SEARCH_RADIUS_KM / EARTH_RADIUS_KM
        assert math.isclose(DBSCAN_EPS, expected, rel_tol=1e-9)

    def test_eps_corresponds_to_500m(self):
        # eps * R_earth ≈ 0.5 km = 500 m
        assert math.isclose(DBSCAN_EPS * EARTH_RADIUS_KM, 0.5, rel_tol=1e-6)

    def test_min_samples(self):
        assert DBSCAN_MIN_SAMPLES == 3

    def test_trust_weight_threshold(self):
        assert TRUST_WEIGHT_THRESHOLD == 0.60

    def test_min_complaints_required(self):
        assert MIN_COMPLAINTS_REQUIRED == 3


# ==========================================================================
# 3. DBSCAN function
# ==========================================================================


class TestRunDbscan:
    def test_tight_cluster_produces_single_label(self):
        # 5 points within 50 m of each other
        pts = np.array([[28.610, 77.209],
                        [28.6101, 77.2091],
                        [28.6102, 77.2092],
                        [28.6103, 77.2093],
                        [28.6104, 77.2094]])
        labels = run_dbscan(np.radians(pts))
        # All should be in one cluster (label 0), none noise
        assert set(labels) == {0}

    def test_dispersed_points_are_noise(self):
        # Points >500 m apart (different cities effectively)
        pts = np.array([[28.61, 77.21],
                        [19.07, 72.87],   # Mumbai
                        [12.97, 77.59]])  # Bengaluru
        labels = run_dbscan(np.radians(pts))
        assert set(labels) == {-1}

    def test_two_separate_clusters(self):
        # Cluster A: ~28.61°N  Cluster B: ~12.97°N (far apart → separate)
        cluster_a = np.array([[28.610, 77.209],
                              [28.6101, 77.2091],
                              [28.6102, 77.2092]])
        cluster_b = np.array([[12.970, 77.590],
                              [12.9701, 77.5901],
                              [12.9702, 77.5902]])
        pts = np.vstack([cluster_a, cluster_b])
        labels = run_dbscan(np.radians(pts))
        unique = set(labels) - {-1}
        assert len(unique) == 2


# ==========================================================================
# 4. Geometry helpers
# ==========================================================================


class TestBuildPolygon:
    def test_returns_polygon_geometry(self):
        coords = np.array([[28.610, 77.209],
                           [28.615, 77.215],
                           [28.605, 77.220],
                           [28.600, 77.210]])
        geom = _build_polygon(coords)
        assert isinstance(geom, PolygonGeometry)

    def test_ring_is_closed(self):
        coords = np.array([[28.610, 77.209],
                           [28.615, 77.215],
                           [28.605, 77.220],
                           [28.600, 77.210]])
        geom = _build_polygon(coords)
        ring = geom.coordinates[0]
        assert ring[0] == ring[-1], "Ring must close on itself"

    def test_coordinates_are_lon_lat(self):
        """GeoJSON §3.1.1 mandates [longitude, latitude] ordering."""
        coords = np.array([[28.610, 77.209],
                           [28.615, 77.215],
                           [28.605, 77.220]])
        geom = _build_polygon(coords)
        # longitude (77.x) > latitude (28.x) for this area
        for pos in geom.coordinates[0]:
            lon, lat = pos
            assert lon > lat, "First element should be longitude (larger for this region)"

    def test_collinear_raises_qhull_error(self):
        # Perfectly collinear in lat, constant lon
        coords = np.array([[28.610, 77.210],
                           [28.611, 77.210],
                           [28.612, 77.210]])
        with pytest.raises(QhullError):
            _build_polygon(coords)


class TestBuildMultipoint:
    def test_returns_multipoint_geometry(self):
        coords = np.array([[28.610, 77.210],
                           [28.611, 77.210],
                           [28.612, 77.210]])
        geom = _build_multipoint(coords)
        assert isinstance(geom, MultiPointGeometry)

    def test_point_count_matches(self):
        coords = np.array([[28.610, 77.210],
                           [28.611, 77.210],
                           [28.612, 77.210]])
        geom = _build_multipoint(coords)
        assert len(geom.coordinates) == 3

    def test_coordinates_are_lon_lat(self):
        coords = np.array([[28.610, 77.210]])
        geom = _build_multipoint(coords)
        lon, lat = geom.coordinates[0]
        assert math.isclose(lon, 77.210) and math.isclose(lat, 28.610)


# ==========================================================================
# 5. Feature builder
# ==========================================================================


class TestBuildFeature:
    def test_polygon_feature_for_non_collinear_cluster(self):
        coords = np.array([[28.610, 77.209],
                           [28.615, 77.215],
                           [28.605, 77.220],
                           [28.600, 77.210]])
        cats = ["Drainage", "Drainage", "Road", "Drainage"]
        feature = _build_feature(0, coords, cats)
        assert feature.geometry.type == "Polygon"
        assert feature.properties.cluster_id == 0
        assert feature.properties.complaint_count == 4
        assert feature.properties.primary_category == "Drainage"

    def test_multipoint_fallback_for_collinear_cluster(self):
        coords = np.array([[28.610, 77.210],
                           [28.611, 77.210],
                           [28.612, 77.210]])
        cats = ["Streetlight", "Streetlight", "Road"]
        feature = _build_feature(1, coords, cats)
        assert feature.geometry.type == "MultiPoint"
        assert feature.properties.complaint_count == 3
        assert feature.properties.primary_category == "Streetlight"

    def test_primary_category_is_mode(self):
        coords = np.array([[28.610, 77.209],
                           [28.615, 77.215],
                           [28.605, 77.220],
                           [28.600, 77.210],
                           [28.595, 77.205]])
        cats = ["Road", "Road", "Road", "Drainage", "Streetlight"]
        feature = _build_feature(2, coords, cats)
        assert feature.properties.primary_category == "Road"


# ==========================================================================
# 6. fetch_trusted_complaints
# ==========================================================================


class TestFetchTrustedComplaints:
    @pytest.mark.asyncio
    async def test_passes_trust_weight_parameter(self):
        mock_conn = AsyncMock()
        mock_conn.fetch = AsyncMock(return_value=[])
        pool = MagicMock()
        pool.acquire = MagicMock(
            return_value=AsyncMock(
                __aenter__=AsyncMock(return_value=mock_conn),
                __aexit__=AsyncMock(return_value=False),
            )
        )
        await fetch_trusted_complaints(pool)
        call_args = mock_conn.fetch.call_args
        # Second positional arg is the $1 SQL parameter
        assert call_args[0][1] == TRUST_WEIGHT_THRESHOLD

    @pytest.mark.asyncio
    async def test_returns_list_of_dicts(self):
        mock_row = {"complaint_id": "x", "category": "Drainage",
                    "latitude": 28.61, "longitude": 77.21}
        pool = _make_pool([mock_row])
        rows = await fetch_trusted_complaints(pool)
        assert isinstance(rows, list)
        assert rows[0]["complaint_id"] == "x"

    @pytest.mark.asyncio
    async def test_empty_result_returns_empty_list(self):
        pool = _make_pool([])
        rows = await fetch_trusted_complaints(pool)
        assert rows == []


# ==========================================================================
# 7. get_cluster_feature_collection — service-level integration
# ==========================================================================


class TestGetClusterFeatureCollection:
    @pytest.mark.asyncio
    async def test_empty_collection_when_no_complaints(self):
        pool = _make_pool([])
        result = await get_cluster_feature_collection(pool)
        assert result.type == "FeatureCollection"
        assert result.features == []

    @pytest.mark.asyncio
    async def test_empty_collection_when_fewer_than_3_complaints(self):
        pool = _make_pool(_CLUSTER_ROWS[:2])
        result = await get_cluster_feature_collection(pool)
        assert result.features == []

    @pytest.mark.asyncio
    async def test_exactly_3_complaints_attempts_clustering(self):
        pool = _make_pool(_CLUSTER_ROWS[:3])
        result = await get_cluster_feature_collection(pool)
        # DBSCAN with min_samples=3 will form one cluster of 3 OR noise
        assert isinstance(result, ClusterFeatureCollection)

    @pytest.mark.asyncio
    async def test_happy_path_returns_feature_collection(self):
        pool = _make_pool(_CLUSTER_ROWS)
        result = await get_cluster_feature_collection(pool)
        assert result.type == "FeatureCollection"
        assert len(result.features) >= 1

    @pytest.mark.asyncio
    async def test_cluster_has_correct_properties(self):
        pool = _make_pool(_CLUSTER_ROWS)
        result = await get_cluster_feature_collection(pool)
        feature = result.features[0]
        assert feature.properties.complaint_count == len(_CLUSTER_ROWS)
        assert feature.properties.primary_category == "Drainage"
        assert feature.properties.cluster_id >= 0

    @pytest.mark.asyncio
    async def test_collinear_points_return_multipoint(self):
        pool = _make_pool(_COLLINEAR_ROWS)
        result = await get_cluster_feature_collection(pool)
        if result.features:
            # Collinear points must fall back to MultiPoint
            assert result.features[0].geometry.type == "MultiPoint"

    @pytest.mark.asyncio
    async def test_all_noise_returns_empty_collection(self):
        # Three points far apart → all noise
        dispersed = [
            {"complaint_id": "n1", "category": "Road",
             "latitude": 28.61, "longitude": 77.21},
            {"complaint_id": "n2", "category": "Road",
             "latitude": 19.07, "longitude": 72.87},
            {"complaint_id": "n3", "category": "Road",
             "latitude": 12.97, "longitude": 77.59},
        ]
        pool = _make_pool(dispersed)
        result = await get_cluster_feature_collection(pool)
        assert result.features == []

    @pytest.mark.asyncio
    async def test_geojson_ring_is_closed(self):
        pool = _make_pool(_CLUSTER_ROWS)
        result = await get_cluster_feature_collection(pool)
        for feature in result.features:
            if feature.geometry.type == "Polygon":
                ring = feature.geometry.coordinates[0]
                assert ring[0] == ring[-1], "Polygon ring must be closed"


# ==========================================================================
# 8. API app — HTTP layer
# ==========================================================================


def _make_app(pool_rows: list[dict] | None = None, raise_exc: bool = False):
    """Return app with the db pool dependency overridden."""
    @asynccontextmanager
    async def _noop_lifespan(_):
        yield

    app.router.lifespan_context = _noop_lifespan
    app.dependency_overrides.clear()

    if raise_exc:
        async def bad_pool():
            raise RuntimeError("DB connection refused")
        app.dependency_overrides[get_db_pool] = bad_pool
    else:
        pool = _make_pool(pool_rows or [])
        async def good_pool():
            return pool
        app.dependency_overrides[get_db_pool] = good_pool

    return app


class TestRouter:
    def test_get_clusters_200_with_features(self):
        app = _make_app(_CLUSTER_ROWS)
        with TestClient(app) as client:
            response = client.get("/api/v1/analytics/clusters")
        assert response.status_code == 200
        body = response.json()
        assert body["type"] == "FeatureCollection"
        assert isinstance(body["features"], list)

    def test_get_clusters_200_empty_collection(self):
        app = _make_app([])
        with TestClient(app) as client:
            response = client.get("/api/v1/analytics/clusters")
        assert response.status_code == 200
        assert response.json() == {"type": "FeatureCollection", "features": []}

    def test_get_clusters_503_on_service_failure(self):
        """503 is returned when the dep resolves but the service call fails."""
        svc_app = _make_app([])

        with patch(
            "DBScan_clustering_pipeline.main.get_cluster_feature_collection",
            new=AsyncMock(side_effect=RuntimeError("DB query failed")),
        ), TestClient(svc_app, raise_server_exceptions=False) as client:
            response = client.get("/api/v1/analytics/clusters")

        assert response.status_code == 503

    def test_response_content_type_is_json(self):
        app = _make_app([])
        with TestClient(app) as client:
            response = client.get("/api/v1/analytics/clusters")
        assert "application/json" in response.headers["content-type"]

    def test_feature_properties_schema(self):
        app = _make_app(_CLUSTER_ROWS)
        with TestClient(app) as client:
            response = client.get("/api/v1/analytics/clusters")
        body = response.json()
        if body["features"]:
            props = body["features"][0]["properties"]
            assert "cluster_id" in props
            assert "complaint_count" in props
            assert "primary_category" in props
