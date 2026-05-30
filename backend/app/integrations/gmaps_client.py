import httpx
import os

GMAPS_BASE = "https://maps.googleapis.com/maps/api"
API_KEY    = os.environ.get("GOOGLE_MAPS_API_KEY", "")


def _parse_step(step: dict) -> dict:
    return {
        "instruction": _strip_html(step.get("html_instructions", "")),
        "distance_m":  step.get("distance", {}).get("value", 0),
        "duration_mins": round(step.get("duration", {}).get("value", 0) / 60),
    }


def _strip_html(text: str) -> str:
    """Remove HTML tags Google injects into instructions."""
    import re
    return re.sub(r"<[^>]+>", " ", text).strip()


def _parse_route(route: dict) -> dict:
    leg = route.get("legs", [{}])[0]  # walking routes always have one leg
    return {
        "source":        "google",
        "duration_mins": round(leg.get("duration", {}).get("value", 0) / 60),
        "departs_at":    "",   # Google doesn't return departure times for walking
        "arrives_at":    "",
        "changes":       0,    # walking only — no changes
        "modes":         ["walking"],
        "distance_m":    leg.get("distance", {}).get("value", 0),
        "summary":       route.get("summary", ""),
        "legs": [
            {
                "mode":          "walking",
                "departure":     leg.get("start_address", ""),
                "arrival":       leg.get("end_address", ""),
                "duration_mins": round(leg.get("duration", {}).get("value", 0) / 60),
                "distance_m":    leg.get("distance", {}).get("value", 0),
                "instruction":   f"Walk from {leg.get('start_address','')} to {leg.get('end_address','')}",
                "steps":         [_parse_step(s) for s in leg.get("steps", [])],
            }
        ],
    }


async def get_walking_routes(origin: str, destination: str) -> list[dict]:
    """
    Get walking routes via Google Maps Directions API.
    Handles destinations inside parks, off-road paths, and
    any location that isn't on the public transport network.

    origin/destination can be:
      - lat,lon string: "51.5074,-0.1278"
      - place name:     "Hyde Park Café, London"
      - address:        "Speakers Corner, Hyde Park"
    """
    params = {
        "origin":      origin,
        "destination": destination,
        "mode":        "walking",
        "alternatives": "true",   # return multiple route options
        "key":         API_KEY,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(
            f"{GMAPS_BASE}/directions/json",
            params=params,
        )
        res.raise_for_status()
        data = res.json()

    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        raise ValueError(f"Google Maps API error: {data.get('status')}")

    return [_parse_route(r) for r in data.get("routes", [])]