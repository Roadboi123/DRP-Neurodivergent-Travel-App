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

def normalize_query(query: str) -> str:
    """Standardize search query for robust cache matching (strips periods, apostrophes, double spaces)."""
    # 1. Lowercase and strip
    q = query.lower().strip()
    # 2. Replace curly apostrophes with straight ones
    q = q.replace("’", "'")
    # 3. Replace abbreviation "st." with "st" (ensuring word boundaries)
    q = re.sub(r'\bst\.\b', 'st', q)
    # 4. Remove all dots
    q = q.replace(".", "")
    # 5. Collapse multiple spaces into one
    q = re.sub(r'\s+', ' ', q)
    return q

# In-memory geocoding cache to minimize external API calls.
# Pre-seeded with the virtual 'current location' fallback coordinates.
_GEOCODE_CACHE = {
    normalize_query(k): v for k, v in {
        "current location": (51.4944, -0.1829),
    }.items()
}

_SUGGESTIONS_CACHE: dict[str, list[dict]] = {}

_COMMON_LONDON_PLACES = [
    {
        "name": "St. John's Wood Underground Station",
        "display_name": "St. John's Wood Underground Station, London, NW8 6DR, United Kingdom",
        "lat": 51.5353523,
        "lon": -0.1742097
    },
    {
        "name": "St. John's Wood",
        "display_name": "St. John's Wood, London, Greater London, United Kingdom",
        "lat": 51.5317260,
        "lon": -0.1741901
    },
    {
        "name": "King's Cross St. Pancras Underground Station",
        "display_name": "King's Cross St. Pancras Underground Station, London, N1 9AL, United Kingdom",
        "lat": 51.5303,
        "lon": -0.1229
    },
    {
        "name": "King's Cross",
        "display_name": "King's Cross, London, Greater London, United Kingdom",
        "lat": 51.5300,
        "lon": -0.1233
    },
    {
        "name": "Earl's Court Underground Station",
        "display_name": "Earl's Court Underground Station, London, SW5 9QA, United Kingdom",
        "lat": 51.4912,
        "lon": -0.1931
    },
    {
        "name": "Barons Court Underground Station",
        "display_name": "Barons Court Underground Station, London, W14 9HD, United Kingdom",
        "lat": 51.4902,
        "lon": -0.2139
    },
    {
        "name": "Queen's Park Underground Station",
        "display_name": "Queen's Park Underground Station, London, NW6 6NL, United Kingdom",
        "lat": 51.5342,
        "lon": -0.2046
    },
    {
        "name": "Shepherd's Bush Underground Station",
        "display_name": "Shepherd's Bush Underground Station, London, W12 8ND, United Kingdom",
        "lat": 51.5042,
        "lon": -0.2186
    },
    {
        "name": "St. James's Park Underground Station",
        "display_name": "St. James's Park Underground Station, London, SW1H 0BD, United Kingdom",
        "lat": 51.4997,
        "lon": -0.1331
    },
    {
        "name": "South Kensington Underground Station",
        "display_name": "South Kensington Underground Station, London, SW7 2LY, United Kingdom",
        "lat": 51.4941,
        "lon": -0.1738
    },
    {
        "name": "Gloucester Road Underground Station",
        "display_name": "Gloucester Road Underground Station, London, SW7 4SF, United Kingdom",
        "lat": 51.4944,
        "lon": -0.1829
    },
    {
        "name": "Victoria Underground Station",
        "display_name": "Victoria Underground Station, London, SW1V 1JT, United Kingdom",
        "lat": 51.4962,
        "lon": -0.1440
    },
    {
        "name": "Waterloo Underground Station",
        "display_name": "Waterloo Underground Station, London, SE1 8SW, United Kingdom",
        "lat": 51.5033,
        "lon": -0.1147
    },
    {
        "name": "London Bridge Underground Station",
        "display_name": "London Bridge Underground Station, London, SE1 9SP, United Kingdom",
        "lat": 51.5050,
        "lon": -0.0860
    },
    {
        "name": "Liverpool Street Underground Station",
        "display_name": "Liverpool Street Underground Station, London, EC2M 7PP, United Kingdom",
        "lat": 51.5178,
        "lon": -0.0820
    },
    {
        "name": "Paddington Underground Station",
        "display_name": "Paddington Underground Station, London, W2 1HB, United Kingdom",
        "lat": 51.5173,
        "lon": -0.1775
    },
    {
        "name": "Euston Underground Station",
        "display_name": "Euston Underground Station, London, NW1 2HS, United Kingdom",
        "lat": 51.5281,
        "lon": -0.1336
    },
    {
        "name": "Oxford Circus Underground Station",
        "display_name": "Oxford Circus Underground Station, London, W1B 3AG, United Kingdom",
        "lat": 51.5152,
        "lon": -0.1419
    },
    {
        "name": "Piccadilly Circus Underground Station",
        "display_name": "Piccadilly Circus Underground Station, London, W1J 9HP, United Kingdom",
        "lat": 51.5101,
        "lon": -0.1340
    },
    {
        "name": "Covent Garden Underground Station",
        "display_name": "Covent Garden Underground Station, London, WC2E 9JT, United Kingdom",
        "lat": 51.5130,
        "lon": -0.1243
    },
    {
        "name": "Westminster Underground Station",
        "display_name": "Westminster Underground Station, London, SW1A 2JR, United Kingdom",
        "lat": 51.5014,
        "lon": -0.1249
    },
    {
        "name": "Green Park Underground Station",
        "display_name": "Green Park Underground Station, London, W1J 8AQ, United Kingdom",
        "lat": 51.5067,
        "lon": -0.1428
    },
    {
        "name": "Slough Station",
        "display_name": "Slough Station, Slough, SL1 1XN, United Kingdom",
        "lat": 51.5117,
        "lon": -0.5915
    },
    {
        "name": "Burnham Station",
        "display_name": "Burnham Station, Burnham, SL1 6JT, United Kingdom",
        "lat": 51.5240,
        "lon": -0.6481
    },
    {
        "name": "Reading Station",
        "display_name": "Reading Station, Reading, RG1 1LZ, United Kingdom",
        "lat": 51.4586,
        "lon": -0.9715
    }
]

# Strict rate-limiting lock and tracker to respect Nominatim's 1 req/sec policy
_last_nominatim_call_time = 0.0
_nominatim_lock = asyncio.Lock()

async def geocode(place: str) -> tuple[float, float] | None:
    """Convert a place name or postcode to lat/lon using Nominatim."""
    global _last_nominatim_call_time
    place = place.strip()
    if not place:
        return None
        
    # Check cache first (fully normalized)
    cache_key = normalize_query(place)
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
            
    return None
    
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


def correct_common_typos(query: str) -> str:
    """Correct common missing apostrophes in transit/place names."""
    replacements = {
        r"\bjohns\b": "john's",
        r"\bkings\b": "king's",
        r"\bqueens\b": "queen's",
        r"\bearls\b": "earl's",
        r"\bbarons\b": "baron's",
        r"\bshepherds\b": "shepherd's",
        r"\bjames\b": "james's",
    }
    q = query.lower()
    for pattern, replacement in replacements.items():
        q = re.sub(pattern, replacement, q)
    return q


async def suggest_locations(query: str) -> list[dict]:
    """Provide location suggestions, prioritizing Greater London and correcting common typos."""
    query = query.strip()
    if len(query) < 3:
        return []

    # Check suggestions cache first
    norm_query = normalize_query(query)
    if norm_query in _SUGGESTIONS_CACHE:
        return _SUGGESTIONS_CACHE[norm_query]

    suggestions = []
    seen_coords = set()

    # 1. Match against local common London places (case-insensitive, ignoring apostrophes)
    norm_query_stripped = norm_query.replace("'", "")
    for place in _COMMON_LONDON_PLACES:
        place_norm_stripped = normalize_query(place["name"]).replace("'", "")
        if norm_query_stripped in place_norm_stripped:
            lat, lon = place["lat"], place["lon"]
            coord_key = (round(lat, 4), round(lon, 4))
            
            parts = place["display_name"].split(",")
            name = parts[0].strip()
            subtitle = ", ".join([p.strip() for p in parts[1:]]).strip() if len(parts) > 1 else ""
            
            sug = {
                "name": name,
                "display_name": place["display_name"],
                "subtitle": subtitle,
                "lat": lat,
                "lon": lon,
                "importance": 1.0,  # Highly important
                "in_london": True
            }
            suggestions.append(sug)
            seen_coords.add(coord_key)

    # 2. Query Nominatim Search API
    corrected_query = correct_common_typos(query)
    headers = {"User-Agent": "CalmTravelApp/1.0 (sivat@uniwork.drp)"}
    params = {
        "q": corrected_query,
        "format": "json",
        "limit": "8",
        "countrycodes": "gb",
        "viewbox": "-0.60,51.75,0.35,51.25"  # Bias to Greater London
    }

    # Strict rate-limiting lock
    global _last_nominatim_call_time
    async with _nominatim_lock:
        now = time.time()
        elapsed = now - _last_nominatim_call_time
        if elapsed < 1.0:
            await asyncio.sleep(1.0 - elapsed)
            
        _last_nominatim_call_time = time.time()
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get("https://nominatim.openstreetmap.org/search", params=params, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    for item in data:
                        try:
                            lat = float(item["lat"])
                            lon = float(item["lon"])
                            coord_key = (round(lat, 4), round(lon, 4))
                            
                            # Skip duplicates
                            if coord_key in seen_coords:
                                continue
                                
                            display_name = item["display_name"]
                            parts = display_name.split(",")
                            name = parts[0].strip()
                            subtitle = ", ".join([p.strip() for p in parts[1:]]).strip() if len(parts) > 1 else ""
                            
                            # Check London bounds
                            in_london = (51.25 <= lat <= 51.75) and (-0.60 <= lon <= 0.35)
                            importance = float(item.get("importance") or 0.0)
                            
                            suggestions.append({
                                "name": name,
                                "display_name": display_name,
                                "subtitle": subtitle,
                                "lat": lat,
                                "lon": lon,
                                "importance": importance,
                                "in_london": in_london
                            })
                            seen_coords.add(coord_key)
                        except (ValueError, KeyError):
                            pass
        except Exception as e:
            print(f"Nominatim suggestions error for '{query}': {e}")

    # 3. Sort suggestions: London results first, then by importance descending
    suggestions.sort(key=lambda x: x.get("importance", 0.0), reverse=True)
    suggestions.sort(key=lambda x: x.get("in_london", False), reverse=True)

    # 4. Strip sorting helper keys before returning/caching
    final_suggestions = []
    for s in suggestions:
        final_suggestions.append({
            "name": s["name"],
            "display_name": s["display_name"],
            "subtitle": s["subtitle"],
            "lat": s["lat"],
            "lon": s["lon"]
        })
        
        # Pre-seed geocode cache
        place_key = normalize_query(s["name"])
        if place_key not in _GEOCODE_CACHE:
            _GEOCODE_CACHE[place_key] = (s["lat"], s["lon"])
            
        full_key = normalize_query(s["display_name"])
        if full_key not in _GEOCODE_CACHE:
            _GEOCODE_CACHE[full_key] = (s["lat"], s["lon"])

    # Cache suggestions
    _SUGGESTIONS_CACHE[norm_query] = final_suggestions
    return final_suggestions

