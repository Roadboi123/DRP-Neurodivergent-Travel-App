"""
Route resolver — decides whether to use TfL, Google Maps, or both,
based on the destination type and distance.
"""
import os
import math
from app.integrations.osm_client import geocode as _geocode

# Destinations matching these keywords are likely off-road
# and should use Google Maps instead of TfL
OFF_ROAD_KEYWORDS = [
    "park", "heath", "common", "garden", "gardens", "forest",
    "wood", "woods", "nature reserve", "trail", "path", "towpath",
    "cemetery", "playing field", "recreation ground",
]

# If the straight-line distance is under this threshold,
# it's probably walkable — skip TfL entirely
WALKING_DISTANCE_THRESHOLD_M = 600


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line distance in metres between two lat/lon points."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi       = math.radians(lat2 - lat1)
    dlambda    = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _looks_off_road(destination: str) -> bool:
    """Check if the destination string suggests an off-road/park location."""
    dest_lower = destination.lower()
    return any(keyword in dest_lower for keyword in OFF_ROAD_KEYWORDS)


# _geocode is imported directly from osm_client


async def resolve_source(
    origin:      str,
    destination: str,
) -> dict:
    """
    Determine the best routing strategy for this origin/destination pair.

    Returns:
      {
        "strategy": "tfl" | "google" | "both",
        "reason":   "human readable explanation",
        "walking_only": bool,
      }
    """
    # Check destination string for off-road keywords
    if _looks_off_road(destination):
        return {
            "strategy":     "google",
            "reason":       "Destination appears to be off-road or inside a park",
            "walking_only": True,
        }

    # Try to geocode both points to check distance
    try:
        origin_coords      = await _geocode(origin)
        destination_coords = await _geocode(destination)

        if origin_coords and destination_coords:
            distance = _haversine_distance(
                origin_coords[0], origin_coords[1],
                destination_coords[0], destination_coords[1],
            )

            if distance < WALKING_DISTANCE_THRESHOLD_M:
                return {
                    "strategy":     "google",
                    "reason":       f"Straight-line distance is {int(distance)}m — likely walkable",
                    "walking_only": True,
                }
    except Exception:
        pass  # If geocoding fails, fall back to TfL + Google both

    # Default — use both and let the frontend show all options
    return {
        "strategy":     "both",
        "reason":       "Returning TfL and walking routes",
        "walking_only": False,
    }