"""
OpenStreetMap Integration Client.
Uses Nominatim for Geocoding and OSRM (Open Source Routing Machine) for Walking Directions.
No API keys or accounts required.
"""
import os
import httpx
import re
import asyncio
import time

# OpenRouteService API Key (optional premium upgrade for realistic walking directions & alternatives)
ORS_API_KEY = os.environ.get("ORS_API_KEY", "")

# In-memory geocoding cache to minimize external API calls.
# Pre-seeded with common local test/demo locations so they work instantly even if Nominatim rate limits you locally!
_GEOCODE_CACHE = {
    "current location": (51.4944, -0.1829),
    "imperial college london": (51.4988, -0.1749),
    "south kensington": (51.4941, -0.1730),
    "south kensington station": (51.4941, -0.1730),
    "gloucester road": (51.4944, -0.1829),
    "gloucester road station": (51.4944, -0.1829),
    "holborn": (51.5173, -0.1200),
    "holborn station": (51.5173, -0.1200),
    "wimbledon": (51.4214, -0.2054),
    "wimbledon station": (51.4214, -0.2054),
}

# Strict rate-limiting lock and tracker to respect Nominatim's 1 req/sec policy
_last_nominatim_call_time = 0.0
_nominatim_lock = asyncio.Lock()

async def geocode(place: str) -> tuple[float, float] | None:
    """Convert a place name or postcode to lat/lon using Nominatim."""
    global _last_nominatim_call_time
    place = place.strip()
    if not place:
        return None
        
    # Check cache first
    cache_key = place.lower()
    if cache_key in _GEOCODE_CACHE:
        return _GEOCODE_CACHE[cache_key]
    
    # 1. Check if it's already a lat,lon pair
    coord_match = re.match(r"^([-+]?(?:[0-9]*\.[0-9]+|[0-9]+))\s*,\s*([-+]?(?:[0-9]*\.[0-9]+|[0-9]+))$", place)
    if coord_match:
        try:
            coords = (float(coord_match.group(1)), float(coord_match.group(2)))
            _GEOCODE_CACHE[cache_key] = coords
            return coords
        except ValueError:
            pass

    # Don't query Nominatim for very short, ambiguous search terms
    if len(place) < 3:
        return None

    # 3. Call Nominatim Geocoding API with a strict 1 request/sec rate limiter lock
    headers = {"User-Agent": "CalmTravelApp/1.0 (sivat@uniwork.drp)"}
    params = {
        "q": place,
        "format": "json",
        "limit": "1",
        "countrycodes": "gb",  # Bias search results to the UK
        "viewbox": "-0.60,51.75,0.35,51.25"  # Heavily bias search results to Greater London/Oyster zones!
    }
    
    async with _nominatim_lock:
        now = time.time()
        elapsed = now - _last_nominatim_call_time
        if elapsed < 1.0:
            await asyncio.sleep(1.0 - elapsed)
            
        _last_nominatim_call_time = time.time()
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get("https://nominatim.openstreetmap.org/search", params=params, headers=headers)
                res.raise_for_status()
                data = res.json()
                if data and len(data) > 0:
                    lat = float(data[0]["lat"])
                    lon = float(data[0]["lon"])
                    coords = (lat, lon)
                    # Cache successful geocode
                    _GEOCODE_CACHE[cache_key] = coords
                    return coords
        except Exception as e:
            print(f"Nominatim geocoding error for '{place}': {e}")
            
    
async def get_osrm_geometry(from_lat: float, from_lon: float, to_lat: float, to_lon: float) -> list[list[float]]:
    """Get detailed walking coordinates between two lat/lon points from OSRM directly."""
    osrm_url = f"https://router.project-osrm.org/route/v1/foot/{from_lon},{from_lat};{to_lon},{to_lat}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
        "alternatives": "false"
    }
    headers = {"User-Agent": "CalmTravelApp/1.0 (sivat@uniwork.drp)"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(osrm_url, params=params, headers=headers)
            if res.status_code == 200:
                data = res.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    geom = data["routes"][0].get("geometry", {})
                    coords = geom.get("coordinates", [])
                    return [[lat, lon] for lon, lat in coords]
    except Exception as e:
        print(f"Error fetching OSRM geometry directly: {e}")
    return []


async def get_walking_routes(origin: str, destination: str) -> list[dict]:
    """
    Get walking routes.
    If ORS_API_KEY is configured in the environment, uses OpenRouteService for premium pedestrian walking directions.
    Otherwise, gracefully falls back to the public OSRM directions engine.
    """
    # 1. Geocode origin and destination
    origin_coords = await geocode(origin)
    dest_coords = await geocode(destination)
    
    if not origin_coords or not dest_coords:
        print(f"OSM Client geocoding failed for origin: '{origin}' or destination: '{destination}'")
        return []
        
    origin_lat, origin_lon = origin_coords
    dest_lat, dest_lon = dest_coords
    
    # 2. Try OpenRouteService if API key is provided
    if ORS_API_KEY and ORS_API_KEY.strip() and ORS_API_KEY.strip() != "your_openrouteservice_api_key_here":
        ors_url = "https://api.openrouteservice.org/v2/directions/foot-walking"
        headers = {
            "Authorization": ORS_API_KEY.strip(),
            "Content-Type": "application/json",
            "User-Agent": "CalmTravelApp/1.0 (sivat@uniwork.drp)"
        }
        # Post payload coordinates: [longitude, latitude]
        payload = {
            "coordinates": [[origin_lon, origin_lat], [dest_lon, dest_lat]],
            "alternative_routes": {
                "target_count": 3
            }
        }
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(ors_url, json=payload, headers=headers)
                res.raise_for_status()
                data = res.json()
                
            features = data.get("features", [])
            if features:
                formatted_routes = []
                for idx, feature in enumerate(features):
                    props = feature.get("properties", {})
                    summary = props.get("summary", {})
                    distance_m = summary.get("distance", 0)
                    duration_secs = summary.get("duration", 0)
                    
                    # OpenRouteService returns true pedestrian walking durations in seconds
                    duration_mins = max(1, round(duration_secs / 60))
                    
                    # Extract some street names from steps to create a beautiful route summary
                    segments = props.get("segments", [{}])
                    summary_suffix = ""
                    if segments:
                        steps = segments[0].get("steps", [])
                        streets = [s.get("name", "") for s in steps if s.get("name") and s.get("name") != "-"]
                        unique_streets = []
                        for s in streets:
                            if s not in unique_streets:
                                unique_streets.append(s)
                        if unique_streets:
                            summary_suffix = " via " + " & ".join(unique_streets[:2])
                            
                    summary_title = f"Walking Route{summary_suffix}"
                    if idx > 0:
                        summary_title += f" (Alt {idx})"
                        
                    geom = feature.get("geometry", {})
                    coords = geom.get("coordinates", [])
                    path_coords = [[lat, lon] for lon, lat in coords] if coords else None

                    formatted_routes.append({
                        "source": "google",
                        "duration_mins": duration_mins,
                        "departs_at": "",
                        "arrives_at": "",
                        "changes": 0,
                        "modes": ["walking"],
                        "distance_m": round(distance_m),
                        "summary": summary_title,
                        "legs": [
                            {
                                "mode": "walking",
                                "departure": origin,
                                "arrival": destination,
                                "duration_mins": duration_mins,
                                "distance_m": round(distance_m),
                                "instruction": f"Walk via {summary_title}",
                                "departure_lat": origin_lat,
                                "departure_lon": origin_lon,
                                "arrival_lat": dest_lat,
                                "arrival_lon": dest_lon,
                                "path_coords": path_coords,
                            }
                        ]
                    })
                return formatted_routes
        except Exception as e:
            print(f"OpenRouteService premium routing failed, falling back to OSRM: {e}")

    # 3. Graceful Fallback: Call OSRM public routing API
    osrm_url = f"https://router.project-osrm.org/route/v1/foot/{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
        "alternatives": "true"
    }
    headers = {"User-Agent": "CalmTravelApp/1.0 (sivat@uniwork.drp)"}
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(osrm_url, params=params, headers=headers)
            res.raise_for_status()
            data = res.json()
            
        if data.get("code") != "Ok" or not data.get("routes"):
            print(f"OSRM public server did not return routes: {data.get('code')}")
            return []
            
        formatted_routes = []
        for idx, r in enumerate(data["routes"]):
            distance_m = r.get("distance", 0)
            
            # Since the public OSRM demo server only hosts the DRIVING profile,
            # it returns driving durations. We calculate realistic walking times 
            # using a standard walking speed of 4.8 km/h (80 meters per minute).
            duration_mins = max(1, round(distance_m / 80.0))
            
            summary = r.get("summary") or r.get("name")
            if not summary or summary.strip() == "":
                summary = f"Walking Route Option {idx + 1}"
            
            geom = r.get("geometry", {})
            coords = geom.get("coordinates", [])
            path_coords = [[lat, lon] for lon, lat in coords] if coords else None

            formatted_routes.append({
                "source": "google",  # Keep 'google' as the source identifier so existing scoring / models line up perfectly
                "duration_mins": duration_mins,
                "departs_at": "",
                "arrives_at": "",
                "changes": 0,
                "modes": ["walking"],
                "distance_m": round(distance_m),
                "summary": summary,
                "legs": [
                    {
                        "mode": "walking",
                        "departure": origin,
                        "arrival": destination,
                        "duration_mins": duration_mins,
                        "distance_m": round(distance_m),
                        "instruction": f"Walk via {summary}" if summary else "Walk to your destination",
                        "departure_lat": origin_lat,
                        "departure_lon": origin_lon,
                        "arrival_lat": dest_lat,
                        "arrival_lon": dest_lon,
                        "path_coords": path_coords,
                    }
                ]
            })
            
        return formatted_routes
    except Exception as e:
        print(f"OSRM public routing service error: {e}")
        return []
