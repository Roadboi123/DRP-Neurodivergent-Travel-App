"""Route suggestion logic: dynamic shaping + personalized sensory scoring.

Operates on plain dicts so the output matches the public contract exactly; the
API layer validates the result through the ``RouteOption`` response model.
"""

import asyncio
import math
import time
from typing import Any, Dict, List, Optional
import httpx

from app.integrations.supabase import supabase
from app.integrations import tlf_client
from app.integrations import osm_client
from app.integrations import route_resolver

_WEATHER_CACHE: Dict[str, Any] = {}

async def get_current_london_temp() -> float:
    """
    Fetch the current temperature in London using Open-Meteo's free API.
    Caches the temperature for 15 minutes to avoid redundant network calls.
    Failsafe defaults to a standard 18.0°C if the API is offline.
    """
    now = time.time()
    if "temp" in _WEATHER_CACHE and now < _WEATHER_CACHE.get("expiry", 0):
        return _WEATHER_CACHE["temp"]
        
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": "51.5074",
        "longitude": "-0.1278",
        "current": "temperature_2m",
    }
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(url, params=params)
            if res.status_code == 200:
                data = res.json()
                temp = float(data.get("current", {}).get("temperature_2m", 18.0))
                # Cache for 15 minutes
                _WEATHER_CACHE["temp"] = temp
                _WEATHER_CACHE["expiry"] = now + 900
                return temp
    except Exception as e:
        print(f"Error fetching current London temperature from Open-Meteo: {e}")
        
    return 18.0

def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    # Radius of the Earth in meters
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

# Mapping Supabase integer sensitivities (1 = little, 2 = medium, 3 = high,
# 4 = very high) to discomfort multiplier weights. Higher sensitivity = more
# strongly affected = larger weight.
WEIGHTS_MAP = {
    1: 0.0,
    2: 1.0,
    3: 2.0,
    4: 3.0,
}


COMMON_STATIONS = {
    "high street kensington": (51.5013, -0.1927),
    "notting hill gate": (51.5091, -0.1961),
    "queensway": (51.5103, -0.1871),
    "lancaster gate": (51.5117, -0.1755),
    "bayswater": (51.5121, -0.1879),
    "paddington": (51.5159, -0.1759),
    "earl's court": (51.4912, -0.1944),
    "gloucester road": (51.4944, -0.1829),
    "south kensington": (51.4941, -0.1730),
    "ealing broadway": (51.5149, -0.2997),
    "north acton": (51.5234, -0.2596),
    "shepherd's bush": (51.5042, -0.2185),
    "white city": (51.5120, -0.2241),
    "holland park": (51.5074, -0.2060),
    "kensington (olympia)": (51.4979, -0.2101),
    "west kensington": (51.4902, -0.2063),
    "barons court": (51.4902, -0.2139),
    "hammersmith": (51.4928, -0.2229),
    "ravenscourt park": (51.4943, -0.2382),
    "stamford brook": (51.4945, -0.2457),
    "turnham green": (51.4951, -0.2501),
    "chiswick park": (51.4944, -0.2678),
    "acton town": (51.5028, -0.2721),
    "south ealing": (51.5011, -0.2872),
    "northfields": (51.4975, -0.2981),
    "boston manor": (51.4956, -0.3250),
    "osterley": (51.4813, -0.3517),
    "hounslow east": (51.4732, -0.3565),
    "hounslow central": (51.4713, -0.3664),
    "hounslow west": (51.4736, -0.3858),
    "hatton cross": (51.4668, -0.4233),
}


async def _get_station_coords(station_name: str) -> Optional[tuple[float, float]]:
    if not station_name:
        return None
    name_clean = station_name.lower()
    for suffix in [" underground station", " station", " railway station", " rail station", " dlr station"]:
        if name_clean.endswith(suffix):
            name_clean = name_clean[:-len(suffix)].strip()
            
    return COMMON_STATIONS.get(name_clean)


async def _create_walking_leg(
    from_name: str, from_lat: float, from_lon: float, to_name: str, to_lat: float, to_lon: float, walking_speed: str
) -> dict:
    # Use mathematical Haversine distance with 1.3 detour factor for instant response times
    dist_m = _haversine_distance(from_lat, from_lon, to_lat, to_lon)
    walk_dist_m = dist_m * 1.3
    
    if walking_speed == "slow":
        speed_m_per_min = 58.3
    elif walking_speed == "average":
        speed_m_per_min = 80.0
    elif walking_speed == "fast":
        speed_m_per_min = 100.0
    else:
        speed_m_per_min = 58.3
        
    duration_mins = max(1, round(walk_dist_m / speed_m_per_min))
    instruction = f"Walk from {from_name} to {to_name}"
    
    return {
        "mode": "walking",
        "departure": from_name,
        "arrival": to_name,
        "departure_naptan": "",
        "arrival_naptan": "",
        "departure_lat": from_lat,
        "departure_lon": from_lon,
        "arrival_lat": to_lat,
        "arrival_lon": to_lon,
        "departs_at": "",
        "arrives_at": "",
        "duration_mins": duration_mins,
        "instruction": instruction,
        "line": "",
        "stops": [],
        "connection_waiting_mins": 0,
    }


def _calculate_leg_sensory(leg: dict, temp: float) -> tuple[int, int, int, int, int]:
    """
    Determine the sensory profile (Sound, Crowds, Heat, Light, Smell)
    on a 1-4 scale for a single transit/walking leg, taking into account
    the actual outdoor temperature for the heat metric.
    """
    mode = str(leg.get("mode", "")).lower()
    line = str(leg.get("line", "")).lower()
    instruction = str(leg.get("instruction", "")).lower()
    
    # Defaults (Low / Calm)
    noise, crowds, heat, light, smell = 1, 1, 1, 1, 1
    
    if mode == "walking":
        # Usually quiet, but check if walking segment is near busy spots
        if "station" in instruction or "busy" in instruction or "crowded" in instruction:
            noise, crowds = 2, 2
        else:
            noise, crowds, heat, light, smell = 1, 1, 1, 1, 1
            
        # Adjust outdoor walk discomfort based on outdoor temperature
        if temp >= 25.0:
            heat = 3
        elif temp >= 20.0:
            heat = 2
        else:
            heat = 1
            
    elif mode == "bus":
        noise = 2   # Engine rumble
        crowds = 2  # Moderate congestion
        light = 2   # Standard overhead bulbs + natural windows
        smell = 2   # Diesel exhaust fumes on street/boarding
        
        # Adjust bus discomfort based on outdoor temperature
        if temp >= 25.0:
            heat = 3
        elif temp >= 18.0:
            heat = 2
        else:
            heat = 1
        
    elif mode in ("tube", "subway", "underground"):
        # Deep level tube lines (Central, Northern, Victoria, Bakerloo, Jubilee, Piccadilly)
        deep_lines = ("central", "northern", "victoria", "bakerloo", "jubilee", "piccadilly")
        if any(dl in line for dl in deep_lines):
            noise = 4   # Deafening rail squeal (can exceed 90dB)
            crowds = 3  # High passenger density
            light = 3   # Glaring fluorescent tubes
            smell = 2   # Train dust and metallic air
            
            # Deep tubes trap heat significantly, becoming sweltering on warm days
            if temp >= 24.0:
                heat = 4
            elif temp >= 15.0:
                heat = 3
            else:
                heat = 2
        else:
            # Sub-surface lines (District, Circle, Hammersmith & City, Metropolitan)
            # Modern, spacious, air-conditioned
            noise = 2   # Moderate screech, wider tunnels
            crowds = 2  # Moderate
            light = 2   # Standard lighting
            smell = 2   # Mild train dust
            
            # Sub-surface lines are fully air-conditioned, so they remain comfortable
            if temp >= 28.0:
                heat = 2
            else:
                heat = 1
            
    elif mode in ("train", "dlr", "overground", "elizabeth-line", "national-rail"):
        if "elizabeth" in line or "elizabeth" in instruction:
            noise = 1   # Brand new, smooth, sound-dampened tracks
            crowds = 2  # Moderate
            heat = 1    # Air-conditioned
            light = 2   # Pleasant recessed soft white lighting
            smell = 1   # Clean, spacious
            
            if temp >= 28.0:
                heat = 2
            else:
                heat = 1
        else:
            # DLR / Overground / Standard rail (mostly air-conditioned)
            noise = 2   # Rail noise
            crowds = 2  # Moderate
            light = 2
            smell = 1   # Better ventilation
            
            if temp >= 25.0:
                heat = 2
            else:
                heat = 1
            
    else:
        # Unknown or generic transit fallback
        noise, crowds, heat, light, smell = 2, 2, 2, 2, 2
        
    return noise, crowds, heat, light, smell


async def _calculate_leg_sensory_live(leg: dict, temp: float) -> tuple[int, int, int, int, int]:
    """
    Determine sensory profile statically, and overlay live TfL crowding & disruption alerts.
    """
    # 1. Start with static baseline heuristics
    noise, crowds, heat, light, smell = _calculate_leg_sensory(leg, temp)
    
    # 2. Check live APIs for transit NaPTAN points
    dep_naptan = leg.get("departure_naptan", "")
    arr_naptan = leg.get("arrival_naptan", "")
    
    tasks = []
    if dep_naptan:
        tasks.append(tlf_client.check_live_station_disruption(dep_naptan))
        tasks.append(tlf_client.check_live_station_crowding(dep_naptan))
    if arr_naptan:
        tasks.append(tlf_client.check_live_station_disruption(arr_naptan))
        tasks.append(tlf_client.check_live_station_crowding(arr_naptan))
        
    if tasks:
        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            # If any live check returns True, escalate crowds and noise to Extreme (4)
            if any(r is True for r in results):
                crowds = 4
                noise = 4
        except Exception:
            pass  # Fall back to static heuristics on any error
            
    return noise, crowds, heat, light, smell


async def _build_route_option(index: int, journey: dict, temp: float) -> dict:
    """
    Format a fetched API journey route to match the frontend RouteOption model schema.
    """
    legs = journey.get("legs", [])
    
    # Calculate sensory levels per leg asynchronously with live API feeds, and use max-pooling for overall journey load
    tasks = [_calculate_leg_sensory_live(leg, temp) for leg in legs]
    raw_profiles = await asyncio.gather(*tasks, return_exceptions=True)
    leg_profiles: List[tuple[int, int, int, int, int]] = [p for p in raw_profiles if isinstance(p, tuple)]
    
    if leg_profiles:
        noise = max(p[0] for p in leg_profiles)
        crowds = max(p[1] for p in leg_profiles)
        heat = max(p[2] for p in leg_profiles)
        light = max(p[3] for p in leg_profiles)
        smell = max(p[4] for p in leg_profiles)
    else:
        noise, crowds, heat, light, smell = 1, 1, 1, 1, 1

    # Dynamically generate a premium route name based on major transit segments
    transit_names = []
    for leg in legs:
        mode = str(leg.get("mode", "")).lower()
        line = leg.get("line", "")
        is_bus_like = mode in ("bus", "coach", "national-coach", "replacement-bus")
        
        if mode == "walking":
            transit_names.append("Walk")
        elif is_bus_like:
            if line:
                transit_names.append(f"Bus {line}")
            else:
                # Extract bus name/operator from instruction if line is empty (e.g. "Green Line 702 towards Windsor")
                instruction = leg.get("instruction", "")
                if instruction:
                    part = instruction.split(" towards ")[0].strip()
                    part = part.replace("Take the ", "").replace("Board the ", "")
                    transit_names.append(part)
                else:
                    transit_names.append("Bus")
        elif mode in ("tube", "subway", "underground") and line:
            # Append tube line name (e.g. "District Line")
            suffix = " Line" if "line" not in line.lower() else ""
            transit_names.append(f"{line}{suffix}")
        elif line:
            transit_names.append(line)
        elif mode != "walking" and mode != "unknown" and mode != "":
            transit_names.append(mode.capitalize())

    if transit_names:
        # De-duplicate adjacent duplicates
        deduped: List[str] = []
        for name in transit_names:
            if not deduped or deduped[-1] != name:
                deduped.append(name)
        route_name = " ➔ ".join(deduped)
    else:
        route_name = "Walk"

    # Compute a realistic price (bus: £1.75, tube/train: £2.80 base zone caps)
    price = 0.0
    has_bus = False
    has_rail = False
    for leg in legs:
        mode = str(leg.get("mode", "")).lower()
        if mode == "bus":
            has_bus = True
        elif mode in ("tube", "subway", "underground", "train", "dlr", "overground", "elizabeth-line", "national-rail"):
            has_rail = True
            
    if has_rail:
        price += 2.80
    if has_bus:
        price += 1.75
        
    duration = int(journey.get("duration_mins", 0))
    source = journey.get("source", "tfl")

    # Construct descriptive neurodivergent-friendly leg summary
    desc_parts = []
    has_deep_tube = False
    has_walk_only = all(str(leg.get("mode", "")).lower() == "walking" for leg in legs)
    
    for leg in legs:
        mode = str(leg.get("mode", "")).lower()
        line = str(leg.get("line", "")).lower()
        if mode in ("tube", "subway", "underground") and any(dl in line for dl in ("central", "northern", "victoria", "bakerloo", "jubilee", "piccadilly")):
            has_deep_tube = True

    if has_walk_only:
        desc_parts.append("A peaceful walking route featuring zero train transfers, fresh air, and outdoor natural light.")
    else:
        if has_deep_tube:
            desc_parts.append("Includes a deep tube line with high screeching noises, standard station congestion, and warmer carriage heat.")
        else:
            desc_parts.append("Uses sub-surface or modern spacious transit lines with air conditioning and quieter tracks.")
            
        changes = max(len([leg for leg in legs if str(leg.get("mode", "")).lower() != "walking"]) - 1, 0)
        if changes > 0:
            desc_parts.append(f"Requires {changes} line transfer{'s' if changes > 1 else ''} which increases walking and platform crowding.")
        else:
            desc_parts.append("Direct line journey with no platform transfers.")
            
        total_wait = sum(int(leg.get("connection_waiting_mins", 0)) for leg in legs)
        if total_wait > 0:
            desc_parts.append(f"Includes {total_wait} minute{'s' if total_wait > 1 else ''} of waiting/interchange time between trains on platforms.")

    description = " ".join(desc_parts)
    
    # Formulate sub-name representing transit modes sequence
    modes_list = [str(leg.get("mode", "")).capitalize() for leg in legs]
    subName = " ➔ ".join(modes_list) if modes_list else None

    # Map legs for front-end rendering
    formatted_legs = []
    for leg in legs:
        formatted_legs.append({
            "mode": leg.get("mode", "walking"),
            "line": leg.get("line", ""),
            "duration_mins": leg.get("duration_mins", 0),
            "departure": leg.get("departure", ""),
            "arrival": leg.get("arrival", ""),
            "instruction": leg.get("instruction", ""),
            "stops": leg.get("stops", []),
            "connection_waiting_mins": leg.get("connection_waiting_mins", 0),
        })

    # Build features tag list for cleaner UI rendering
    features = []
    
    if has_walk_only:
        features.append({"type": "aircon", "label": "Fresh Air", "icon": "leaf-outline", "color": "green"})
        features.append({"type": "noise", "label": "Quiet Route", "icon": "volume-mute-outline", "color": "green"})
    else:
        if has_deep_tube:
            features.append({"type": "aircon", "label": "No A/C", "icon": "alert-circle-outline", "color": "red"})
            features.append({"type": "heat", "label": "Warm Carriage", "icon": "thermometer-outline", "color": "red"})
            features.append({"type": "noise", "label": "Loud Rail Squeal", "icon": "volume-high-outline", "color": "red"})
        else:
            features.append({"type": "aircon", "label": "Air Conditioned", "icon": "snow-outline", "color": "green"})
            features.append({"type": "noise", "label": "Quiet Tracks", "icon": "volume-low-outline", "color": "green"})

    changes = max(len([leg for leg in legs if str(leg.get("mode", "")).lower() != "walking"]) - 1, 0)
    if changes == 0:
        features.append({"type": "transfers", "label": "Direct Line", "icon": "arrow-forward-outline", "color": "green"})
    else:
        features.append({"type": "transfers", "label": f"{changes} Transfer{'s' if changes > 1 else ''}", "icon": "shuffle-outline", "color": "orange"})

    total_wait = sum(int(leg.get("connection_waiting_mins", 0)) for leg in legs)
    if total_wait > 0:
        features.append({"type": "waiting", "label": f"{total_wait}m Plat. Wait", "icon": "time-outline", "color": "orange"})

    return {
        "id": f"real_r{index}",
        "name": route_name,
        "subName": subName,
        "duration": duration,
        "price": price,
        "noise": noise,
        "crowds": crowds,
        "heat": heat,
        "light": light,
        "smell": smell,
        "description": description,
        "source": source,
        "legs": formatted_legs,
        "features": features,
    }


async def get_route_suggestions(
    start: str, end: str, username: Optional[str] = None, walking_speed: Optional[str] = "slow"
) -> List[Dict[str, Any]]:
    """
    Get route suggestions based on start/end destinations,
    optionally applying personalized user sensitivities from Supabase.
    """
    if not start or not start.strip() or not end or not end.strip():
        return []

    # 1. Resolve strategy (TfL, Google, or Both)
    try:
        strategy_info = await route_resolver.resolve_source(start, end)
        strategy = strategy_info.get("strategy", "both")
    except Exception as e:
        print(f"Route resolver exception: {e}")
        strategy = "both"

    # 2. Query clients in parallel based on strategy
    from typing import Coroutine
    tfl_task: Optional[Coroutine[Any, Any, List[Dict[str, Any]]]] = None
    gmaps_task: Optional[Coroutine[Any, Any, List[Dict[str, Any]]]] = None

    # Geocode to coordinates to bypass TfL "300 Multiple Choices" ambiguity redirects (only for London/commuter belt queries)
    from app.integrations.osm_client import geocode
    start_coords = await geocode(start)
    end_coords = await geocode(end)
    
    def is_in_commuter_belt(lat: float, lon: float) -> bool:
        # Covers the entire London commuter belt from Reading/Slough in the west (-1.05 lon)
        # to Shenfield/Southend in the east (0.45 lon), plus commuter limits north/south
        return 51.15 <= lat <= 51.85 and -1.05 <= lon <= 0.45
        
    tfl_start = f"{start_coords[0]},{start_coords[1]}" if (start_coords and is_in_commuter_belt(start_coords[0], start_coords[1])) else start
    tfl_end = f"{end_coords[0]},{end_coords[1]}" if (end_coords and is_in_commuter_belt(end_coords[0], end_coords[1])) else end

    if strategy in ("tfl", "both"):
        tfl_task = tlf_client.get_routes(tfl_start, tfl_end, walking_speed=walking_speed)
    if strategy in ("google", "both"):
        gmaps_task = osm_client.get_walking_routes(start, end)

    tfl_res: Any = None
    gmaps_res: Any = None
    raw_journeys: List[Dict[str, Any]] = []

    try:
        if tfl_task and gmaps_task:
            tfl_res, gmaps_res = await asyncio.gather(tfl_task, gmaps_task, return_exceptions=True)
            if isinstance(tfl_res, list):
                raw_journeys.extend(tfl_res)
            else:
                print(f"TfL fetch error: {tfl_res}")
            if isinstance(gmaps_res, list):
                raw_journeys.extend(gmaps_res)
            else:
                print(f"Google Maps fetch error: {gmaps_res}")
        elif tfl_task:
            tfl_res = await tfl_task
            if isinstance(tfl_res, list):
                raw_journeys.extend(tfl_res)
        elif gmaps_task:
            gmaps_res = await gmaps_task
            if isinstance(gmaps_res, list):
                raw_journeys.extend(gmaps_res)
    except Exception as e:
        print(f"Error querying live routing APIs: {e}")

    # 2.5 Walk-Transfer Short-Circuiting (synthesize early exit walks for transit transfer stations/stops within 2km of destination)
    if end_coords:
        dest_lat, dest_lon = end_coords
        dest_name = end
        
        seen_sigs = set()
        for rj in raw_journeys:
            leg_sig = tuple(
                (leg.get("mode"), leg.get("line"), leg.get("departure"), leg.get("arrival"))
                for leg in rj.get("legs", [])
            )
            seen_sigs.add(leg_sig)
            
        new_short_circuits = []
        
        for j in raw_journeys:
            if j.get("source") != "tfl":
                continue
                
            legs = j.get("legs", [])
            for idx, leg in enumerate(legs):
                is_transit = leg.get("mode") not in ("walking", "unknown", "")
                if not is_transit:
                    continue
                    
                # Option A: Exit at the arrival station of this leg (if we are skipping subsequent transit transfers)
                has_later_transit = any(
                    legs[k].get("mode") not in ("walking", "unknown", "")
                    for k in range(idx + 1, len(legs))
                )
                
                arr_lat = leg.get("arrival_lat")
                arr_lon = leg.get("arrival_lon")
                arr_name = leg.get("arrival")
                
                if arr_lat is not None and arr_lon is not None and has_later_transit:
                    dist = _haversine_distance(arr_lat, arr_lon, dest_lat, dest_lon)
                    if dist <= 2000:
                        # Construct a short-circuit walk leg
                        new_walk_leg = await _create_walking_leg(
                            from_name=arr_name,
                            from_lat=arr_lat,
                            from_lon=arr_lon,
                            to_name=dest_name,
                            to_lat=dest_lat,
                            to_lon=dest_lon,
                            walking_speed=walking_speed or "slow"
                        )
                        
                        # Generate the new journey legs
                        new_legs = []
                        for k in range(idx + 1):
                            new_legs.append(legs[k].copy())
                        new_legs[-1]["connection_waiting_mins"] = 0
                        new_legs.append(new_walk_leg)
                        
                        new_sig = tuple(
                            (nl.get("mode"), nl.get("line"), nl.get("departure"), nl.get("arrival"))
                            for nl in new_legs
                        )
                        if new_sig not in seen_sigs:
                            seen_sigs.add(new_sig)
                            new_short_circuits.append({
                                "source": "tfl",
                                "duration_mins": sum(nl.get("duration_mins", 0) + nl.get("connection_waiting_mins", 0) for nl in new_legs),
                                "departs_at": j.get("departs_at"),
                                "arrives_at": "",
                                "changes": max(len([nl for nl in new_legs if nl.get("mode") not in ("walking", "unknown", "")]) - 1, 0),
                                "modes": list({nl.get("mode", "") for nl in new_legs}),
                                "legs": new_legs
                            })
                            
                # Option B: Exit at an intermediate stop of this leg
                stops = leg.get("stops", [])
                for stop_idx, stop_name in enumerate(stops):
                    stop_coords = await _get_station_coords(stop_name)
                    if stop_coords:
                        stop_lat, stop_lon = stop_coords
                        dist = _haversine_distance(stop_lat, stop_lon, dest_lat, dest_lon)
                        if dist <= 2000:
                            # Construct the walking leg from the intermediate stop
                            new_walk_leg = await _create_walking_leg(
                                from_name=stop_name,
                                from_lat=stop_lat,
                                from_lon=stop_lon,
                                to_name=dest_name,
                                to_lat=dest_lat,
                                to_lon=dest_lon,
                                walking_speed=walking_speed or "slow"
                            )
                            
                            # Prepare modified transit leg up to the intermediate stop
                            modified_leg = leg.copy()
                            modified_leg["arrival"] = stop_name
                            modified_leg["arrival_naptan"] = ""
                            modified_leg["arrival_lat"] = stop_lat
                            modified_leg["arrival_lon"] = stop_lon
                            
                            # Interpolate duration
                            total_stops = len(stops)
                            fraction = (stop_idx + 1) / (total_stops + 1)
                            modified_leg["duration_mins"] = max(1, round(leg.get("duration_mins", 0) * fraction))
                            modified_leg["stops"] = stops[:stop_idx]
                            modified_leg["connection_waiting_mins"] = 0
                            
                            # Generate new journey legs
                            new_legs = []
                            for k in range(idx):
                                new_legs.append(legs[k].copy())
                            new_legs.append(modified_leg)
                            new_legs.append(new_walk_leg)
                            
                            new_sig = tuple(
                                (nl.get("mode"), nl.get("line"), nl.get("departure"), nl.get("arrival"))
                                for nl in new_legs
                            )
                            if new_sig not in seen_sigs:
                                seen_sigs.add(new_sig)
                                new_short_circuits.append({
                                    "source": "tfl",
                                    "duration_mins": sum(nl.get("duration_mins", 0) + nl.get("connection_waiting_mins", 0) for nl in new_legs),
                                    "departs_at": j.get("departs_at"),
                                    "arrives_at": "",
                                    "changes": max(len([nl for nl in new_legs if nl.get("mode") not in ("walking", "unknown", "")]) - 1, 0),
                                    "modes": list({nl.get("mode", "") for nl in new_legs}),
                                    "legs": new_legs
                                })
                                
        raw_journeys.extend(new_short_circuits)

    # Fetch London current temperature
    temp = await get_current_london_temp()

    # Map raw journeys to frontend schema asynchronously in parallel
    tasks = [_build_route_option(i, j, temp) for i, j in enumerate(raw_journeys)]
    route_options = await asyncio.gather(*tasks, return_exceptions=True)
    routes = [r for r in route_options if isinstance(r, dict)]

    # Filter out walking options that take longer than 30 minutes,
    # unless it is the only option available (to ensure results are never empty)
    has_transit = any(r.get("source") == "tfl" for r in routes)
    if has_transit:
        routes = [
            r for r in routes
            if not (r.get("source") == "google" and r.get("duration", 0) > 30)
        ]

    if not routes:
        return []

    # 3. Retrieve user preferences from Supabase if username is active
    user_prefs: Optional[Dict[str, Any]] = None
    if username and username.strip():
        try:
            res = supabase.table("user_sensitivities") \
                .select("*") \
                .eq("username", username.strip()) \
                .execute()
            
            if res.data and isinstance(res.data, list) and len(res.data) > 0:
                prefs_data = res.data[0]
                if isinstance(prefs_data, dict):
                    user_prefs = prefs_data
        except Exception as e:
            print(f"Error fetching Supabase sensitivities for user {username}: {e}")

    # 4. Calculate personalized match scores for all routes
    for r in routes:
        mismatch_triggers = []
        if user_prefs:
            u_noise = int(user_prefs.get("noise_sensitivity") or 2)
            u_crowds = int(user_prefs.get("crowd_sensitivity") or 2)
            u_heat = int(user_prefs.get("heat_sensitivity") or 2)
            u_light = int(user_prefs.get("light_sensitivity") or 2)
            u_smell = int(user_prefs.get("smell_sensitivity") or 2)

            w_noise = WEIGHTS_MAP.get(u_noise, 1.5)
            w_crowds = WEIGHTS_MAP.get(u_crowds, 1.5)
            w_heat = WEIGHTS_MAP.get(u_heat, 1.5)
            w_light = WEIGHTS_MAP.get(u_light, 1.5)
            w_smell = WEIGHTS_MAP.get(u_smell, 1.5)

            # Lower score is better/calmer
            sensory_score = (
                w_noise * r["noise"] +
                w_crowds * r["crowds"] +
                w_heat * r["heat"] +
                w_light * r["light"] +
                w_smell * r["smell"]
            )
            r["sensory_score"] = round(sensory_score, 2)

            # Mismatches (highly sensitive [high=3 or very high=4] and trigger level >= 2)
            if u_noise >= 3 and r["noise"] >= 2:
                mismatch_triggers.append("sound")
            if u_crowds >= 3 and r["crowds"] >= 2:
                mismatch_triggers.append("crowds")
            if u_heat >= 3 and r["heat"] >= 2:
                mismatch_triggers.append("heat")
            if u_light >= 3 and r["light"] >= 2:
                mismatch_triggers.append("bright light")
            if u_smell >= 3 and r["smell"] >= 2:
                mismatch_triggers.append("fumes/scents")

            max_discomfort = (
                w_noise * 4 +
                w_crowds * 4 +
                w_heat * 4 +
                w_light * 4 +
                w_smell * 4
            )
            
            if max_discomfort > 0:
                match_pct = max(0, min(100, int(100 - (sensory_score / max_discomfort) * 100)))
            else:
                match_pct = 100
                
            r["match_percentage"] = match_pct

            if len(mismatch_triggers) > 0:
                r["sensory_description"] = f"⚠️ High sensory load: includes triggers ({', '.join(mismatch_triggers)}) that affect you."
            else:
                r["sensory_description"] = "✅ Excellent match: completely aligned with your sensory profile."
        else:
            # Fallback score (simple sum of all 5 metrics)
            sensory_score = float(r["noise"] + r["crowds"] + r["heat"] + r["light"] + r["smell"])
            r["sensory_score"] = sensory_score
            r["match_percentage"] = int(max(0, 100 - (sensory_score / 20) * 60))
            r["sensory_description"] = "Enter a username to view personalized sensory alignment ratings."

    # 5. Determine types: safest/calmest vs. quickest
    quickest_route = min(routes, key=lambda x: x["duration"])
    best_route = min(routes, key=lambda x: x["sensory_score"])

    for r in routes:
        if r["id"] == best_route["id"]:
            r["type"] = "best"
        elif r["id"] == quickest_route["id"]:
            r["type"] = "quickest"
        else:
            r["type"] = "suggested"

    # Sort so calmest/best route is highlighted first
    routes.sort(key=lambda x: (0 if x["type"] == "best" else 1 if x["type"] == "quickest" else 2))

    return routes
