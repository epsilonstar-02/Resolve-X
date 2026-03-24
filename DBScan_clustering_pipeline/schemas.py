"""
schemas.py — RX-021: DBSCAN Spatial Clustering
GeoJSON FeatureCollection response models.

Conforms to RFC 7946 (GeoJSON specification).
All geometry coordinates are [longitude, latitude] per the spec.
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Geometry primitives
# ---------------------------------------------------------------------------


class PolygonGeometry(BaseModel):
    """GeoJSON Polygon geometry (RFC 7946 §3.1.6).

    ``coordinates`` is a list of linear rings; the first (and here only)
    ring is the exterior boundary.  Each position is [lon, lat].
    The ring MUST be closed: first == last position.
    """

    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]] = Field(
        ...,
        description=(
            "Array of linear rings. "
            "coordinates[0] is the exterior ring [[lon, lat], ...]."
        ),
    )


class MultiPointGeometry(BaseModel):
    """GeoJSON MultiPoint geometry (RFC 7946 §3.1.3).

    Used as a fallback when ConvexHull cannot be computed (collinear points).
    """

    type: Literal["MultiPoint"] = "MultiPoint"
    coordinates: list[list[float]] = Field(
        ...,
        description="Array of positions [[lon, lat], ...].",
    )


# Union type used in Feature below
ClusterGeometry = Annotated[
    Union[PolygonGeometry, MultiPointGeometry],
    Field(discriminator="type"),
]


# ---------------------------------------------------------------------------
# Feature properties
# ---------------------------------------------------------------------------


class ClusterProperties(BaseModel):
    """Properties attached to every cluster Feature."""

    cluster_id: int = Field(
        ...,
        description="DBSCAN-assigned cluster label (≥ 0; noise points excluded).",
        ge=0,
    )
    complaint_count: int = Field(
        ...,
        description="Total number of complaints within this cluster.",
        gt=0,
    )
    primary_category: str = Field(
        ...,
        description="Most frequent complaint category within the cluster.",
    )


# ---------------------------------------------------------------------------
# GeoJSON Feature & FeatureCollection
# ---------------------------------------------------------------------------


class ClusterFeature(BaseModel):
    """A single GeoJSON Feature wrapping one DBSCAN cluster."""

    type: Literal["Feature"] = "Feature"
    geometry: ClusterGeometry
    properties: ClusterProperties


class ClusterFeatureCollection(BaseModel):
    """Top-level GeoJSON FeatureCollection returned by GET /clusters.

    An empty ``features`` list is a valid response when fewer than 3
    trusted complaints exist in the rolling 30-day window.
    """

    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[ClusterFeature] = Field(
        default_factory=list,
        description="Zero or more cluster polygon features.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [
                                [
                                    [77.209, 28.614],
                                    [77.210, 28.616],
                                    [77.211, 28.613],
                                    [77.209, 28.614],
                                ]
                            ],
                        },
                        "properties": {
                            "cluster_id": 0,
                            "complaint_count": 18,
                            "primary_category": "Drainage",
                        },
                    }
                ],
            }
        }
    }
