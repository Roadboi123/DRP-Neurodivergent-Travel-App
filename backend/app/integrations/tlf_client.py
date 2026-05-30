import httpx
import os

TFL_BASE = "https://api.tfl.gov.uk"
APP_KEY  = os.environ.get("TFL_APP_KEY", "")


def _parse_leg(leg: dict) -> dict:
    return {
        "mode":          leg.get("mode", {}).get("name", "unknown"),
        "departure":     leg.get("departurePoint", {}).get("commonName", ""),
        "arrival":       leg.get("arrivalPoint", {}).get("commonName", ""),
        "departs_at":    leg.get("departureTime", ""),
        "arrives_at":    leg.get("arrivalTime", ""),
        "duration_mins": leg.get("duration", 0),
        "instruction":   leg.get("instruction", {}).get("summary", ""),
        "line":          leg.get("routeOptions", [{}])[0]
                            .get("lineIdentifier", {})
                            .get("name", "") if leg.get("routeOptions") else "",
    }


def _parse_journey(journey: dict) -> dict:
    legs  = journey.get("legs", [])
    modes = list({leg.get("mode", {}).get("name", "") for leg in legs})
    return {
        "source":        "tfl",
        "duration_mins": journey.get("duration", 0),
        "departs_at":    journey.get("startDateTime", ""),
        "arrives_at":    journey.get("arrivalDateTime", ""),
        "changes":       max(len([l for l in legs if l.get("mode", {}).get("name") != "walking"]) - 1, 0),
        "modes":         modes,
        "legs":          [_parse_leg(l) for l in legs],
    }


async def get_routes(
    origin:       str,
    destination:  str,
    time:         str | None = None,
    walking_only: bool = False,
) -> list[dict]:
    params: dict = {
        "app_key":            APP_KEY,
        "journeyPreference":  "LeastTime",
        "alternativeWalking": "true",
    }
    if walking_only:
        params["mode"]               = "walking"
        params["walkingOptimization"] = "true"
    if time:
        params["time"] = time

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(
            f"{TFL_BASE}/Journey/JourneyResults/{origin}/to/{destination}",
            params=params,
        )
        res.raise_for_status()

    return [_parse_journey(j) for j in res.json().get("journeys", [])]