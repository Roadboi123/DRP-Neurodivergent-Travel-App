import httpx
import os
import time
import asyncio
import json

TFL_BASE = "https://api.tfl.gov.uk"
APP_KEY  = os.environ.get("TFL_APP_KEY", "")

# In-memory caches to prevent spamming the TfL API and restore sub-100ms response times
_LIVE_DISRUPTION_CACHE: dict[str, tuple[bool, float]] = {}
_LIVE_CROWDING_CACHE: dict[str, tuple[bool, float]] = {}
CACHE_TTL_SECS = 300  # 5-minute cache lifespan

_DISRUPTION_LOCKS: dict[str, asyncio.Lock] = {}
_CROWDING_LOCKS: dict[str, asyncio.Lock] = {}

_LIVE_STATION_WORKS_CACHE: list[str] = []
_LIVE_STATION_WORKS_EXPIRY: float = 0.0
_STATION_WORKS_LOCK = asyncio.Lock()
_IS_REFRESHING_STATION_WORKS: bool = False

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

# Station coordinates cache variables and file path
INTEGRATIONS_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(INTEGRATIONS_DIR)
CACHE_FILE_PATH = os.path.join(APP_DIR, "data", "station_coords_cache.json")

_STATION_COORDS_CACHE: dict[str, list[float]] = {}
_CACHE_LOCK = asyncio.Lock()
_STATION_COORDS_LOCKS: dict[str, asyncio.Lock] = {}


def load_station_coords_cache():
    global _STATION_COORDS_CACHE
    if os.path.exists(CACHE_FILE_PATH):
        try:
            with open(CACHE_FILE_PATH, "r") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    _STATION_COORDS_CACHE = {k: v for k, v in data.items() if isinstance(v, list) and len(v) == 2}
                    print(f"Loaded {len(_STATION_COORDS_CACHE)} cached station coordinates from {CACHE_FILE_PATH}")
        except Exception as e:
            print(f"Error loading station coords cache: {e}")

load_station_coords_cache()


async def save_station_coords_cache():
    async with _CACHE_LOCK:
        try:
            def write_file():
                os.makedirs(os.path.dirname(CACHE_FILE_PATH), exist_ok=True)
                with open(CACHE_FILE_PATH, "w") as f:
                    json.dump(_STATION_COORDS_CACHE, f, indent=2)
            await asyncio.to_thread(write_file)
        except Exception as e:
            print(f"Error saving station coords cache: {e}")


async def get_station_coords(naptan_id: str | None, station_name: str | None) -> tuple[float, float] | None:
    # 1. Check naptan_id in cache
    if naptan_id:
        naptan_id = naptan_id.strip().upper()
        if naptan_id in _STATION_COORDS_CACHE:
            cached_naptan = _STATION_COORDS_CACHE[naptan_id]
            return (float(cached_naptan[0]), float(cached_naptan[1]))
            
    # 2. Normalize station name
    name_clean = ""
    if station_name:
        name_clean = clean_station_name(station_name)
        if name_clean in _STATION_COORDS_CACHE:
            cached_name = _STATION_COORDS_CACHE[name_clean]
            return (float(cached_name[0]), float(cached_name[1]))
            
    # 3. Check COMMON_STATIONS
    if name_clean and name_clean in COMMON_STATIONS:
        coords = COMMON_STATIONS[name_clean]
        _STATION_COORDS_CACHE[name_clean] = list(coords)
        if naptan_id:
            _STATION_COORDS_CACHE[naptan_id] = list(coords)
        return coords

    # 4. Fetch from TfL StopPoint API if we have naptan_id
    if naptan_id:
        if naptan_id not in _STATION_COORDS_LOCKS:
            _STATION_COORDS_LOCKS[naptan_id] = asyncio.Lock()
            
        async with _STATION_COORDS_LOCKS[naptan_id]:
            # Double-check cache inside lock
            if naptan_id in _STATION_COORDS_CACHE:
                cached_naptan_lock = _STATION_COORDS_CACHE[naptan_id]
                return (float(cached_naptan_lock[0]), float(cached_naptan_lock[1]))
                
            url = f"{TFL_BASE}/StopPoint/{naptan_id}"
            params = {}
            if APP_KEY:
                params["app_key"] = APP_KEY
                
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    res = await client.get(url, params=params)
                    if res.status_code == 200:
                        data = res.json()
                        lat = data.get("lat")
                        lon = data.get("lon")
                        if lat is not None and lon is not None:
                            coords = (float(lat), float(lon))
                            _STATION_COORDS_CACHE[naptan_id] = list(coords)
                            if name_clean:
                                _STATION_COORDS_CACHE[name_clean] = list(coords)
                            await save_station_coords_cache()
                            return coords
            except Exception as e:
                print(f"Error fetching TfL StopPoint coordinates for {naptan_id}: {e}")

    # 5. Last resort: geocode using osm_client
    if name_clean:
        if name_clean not in _STATION_COORDS_LOCKS:
            _STATION_COORDS_LOCKS[name_clean] = asyncio.Lock()
            
        async with _STATION_COORDS_LOCKS[name_clean]:
            if name_clean in _STATION_COORDS_CACHE:
                cached_name_lock = _STATION_COORDS_CACHE[name_clean]
                return (float(cached_name_lock[0]), float(cached_name_lock[1]))
                
            try:
                from app.integrations.osm_client import geocode
                query_name = f"{station_name}"
                if "station" not in query_name.lower():
                    query_name += " Station"
                res_coords = await geocode(query_name)
                if res_coords:
                    _STATION_COORDS_CACHE[name_clean] = list(res_coords)
                    if naptan_id:
                        _STATION_COORDS_CACHE[naptan_id] = list(res_coords)
                    await save_station_coords_cache()
                    return res_coords
            except Exception as e:
                print(f"Error geocoding station {station_name}: {e}")

    return None


def clean_station_name(name: str) -> str:
    n = name.lower()
    for suffix in [" underground station", " railway station", " rail station", " dlr station", " station"]:
        if n.endswith(suffix):
            n = n[:-len(suffix)]
    return n.strip()


async def _parse_leg(leg: dict) -> dict:
    path_coords = []
    mode = leg.get("mode", {}).get("name", "unknown")
    
    departure = leg.get("departurePoint", {}).get("commonName", "")
    arrival = leg.get("arrivalPoint", {}).get("commonName", "")

    dep_c = clean_station_name(departure)
    arr_c = clean_station_name(arrival)

    raw_stops = [sp.get("name") for sp in leg.get("path", {}).get("stopPoints", [])]
    stops = []
    for stop in raw_stops:
        stop_name = stop or ""
        stop_c = clean_station_name(stop_name)
        if stop_c != dep_c and stop_c != arr_c:
            stops.append(stop_name)

    # For stop details
    raw_stop_objs = leg.get("path", {}).get("stopPoints", [])
    stop_points = []
    for sp in raw_stop_objs:
        sp_name = sp.get("name") or ""
        sp_id = sp.get("id") or ""
        stop_c = clean_station_name(sp_name)
        if stop_c != dep_c and stop_c != arr_c:
            stop_points.append({
                "id": sp_id,
                "name": sp_name
            })

    departure_lat = leg.get("departurePoint", {}).get("lat")
    departure_lon = leg.get("departurePoint", {}).get("lon")
    arrival_lat = leg.get("arrivalPoint", {}).get("lat")
    arrival_lon = leg.get("arrivalPoint", {}).get("lon")

    # Define outer London/commuter rail keywords where TfL's lineString defaults to street routing
    OUTER_RAIL_KEYWORDS = {
        "burnham", "slough", "reading", "twyford", "maidenhead", "taplow",
        "langley", "iver", "shenfield", "brentwood", "windsor", "watford",
        "st albans", "guildford", "woking", "bracknell"
    }

    is_outer_rail = False
    dep_lower = departure.lower()
    arr_lower = arrival.lower()
    if mode in {"tube", "dlr", "overground", "elizabeth-line", "national-rail", "train", "tram", "subway", "underground"}:
        if any(kw in dep_lower or kw in arr_lower for kw in OUTER_RAIL_KEYWORDS):
            is_outer_rail = True

    # Try to load TfL's original lineString first (if not an outer rail segment with known street routing fallback)
    line_string_str = leg.get("path", {}).get("lineString")
    if not is_outer_rail and line_string_str:
        try:
            path_coords = json.loads(line_string_str)
        except Exception as e:
            print(f"Error parsing TfL lineString: {e}")

    RAIL_MODES = {"tube", "dlr", "overground", "elizabeth-line", "national-rail", "train", "tram", "subway", "underground"}

    # If it's a rail mode and lineString is missing/empty/invalid (or bypassed), construct station-to-station straight line path
    if (not path_coords or len(path_coords) < 2) and mode in RAIL_MODES:
        path_coords = []
        if departure_lat is not None and departure_lon is not None:
            path_coords.append([float(departure_lat), float(departure_lon)])
            
        # Resolve all stop point coordinates in parallel
        sp_coords_list = await asyncio.gather(*(get_station_coords(sp["id"], sp["name"]) for sp in stop_points))
        for sp_coords in sp_coords_list:
            if sp_coords:
                path_coords.append([sp_coords[0], sp_coords[1]])
                
        if arrival_lat is not None and arrival_lon is not None:
            path_coords.append([float(arrival_lat), float(arrival_lon)])
            
        # Hard fallback to direct straight line dep -> arr
        if len(path_coords) < 2 and departure_lat is not None and departure_lon is not None and arrival_lat is not None and arrival_lon is not None:
            path_coords = [[float(departure_lat), float(departure_lon)], [float(arrival_lat), float(arrival_lon)]]

    return {
        "mode":          mode,
        "departure":     departure,
        "arrival":       arrival,
        "departure_naptan": leg.get("departurePoint", {}).get("naptanId", ""),
        "arrival_naptan":   leg.get("arrivalPoint", {}).get("naptanId", ""),
        "departure_lat":    departure_lat,
        "departure_lon":    departure_lon,
        "arrival_lat":      arrival_lat,
        "arrival_lon":      arrival_lon,
        "departs_at":    leg.get("departureTime", ""),
        "arrives_at":    leg.get("arrivalTime", ""),
        "duration_mins": leg.get("duration", 0),
        "instruction":   leg.get("instruction", {}).get("summary", ""),
        "line":          leg.get("routeOptions", [{}])[0]
                            .get("lineIdentifier", {})
                            .get("name", "") if leg.get("routeOptions") else "",
        "stops":         stops,
        "stop_points":   stop_points,
        "path_coords":   path_coords,
    }


async def check_live_station_disruption(naptan_id: str) -> bool:
    """
    Query TfL's live StopPoint disruption feed to check for crowding or event alerts.
    Utilizes an in-memory TTL cache and asyncio locking to prevent duplicate requests.
    """
    if not naptan_id:
        return False
        
    now = time.time()
    if naptan_id in _LIVE_DISRUPTION_CACHE:
        val, expiry = _LIVE_DISRUPTION_CACHE[naptan_id]
        if now < expiry:
            return val
            
    if naptan_id not in _DISRUPTION_LOCKS:
        _DISRUPTION_LOCKS[naptan_id] = asyncio.Lock()
        
    async with _DISRUPTION_LOCKS[naptan_id]:
        # Double-check cache in case another task populated it while we waited
        now = time.time()
        if naptan_id in _LIVE_DISRUPTION_CACHE:
            val, expiry = _LIVE_DISRUPTION_CACHE[naptan_id]
            if now < expiry:
                return val
                
        val = False
        url = f"{TFL_BASE}/StopPoint/{naptan_id}/Disruption"
        params = {}
        if APP_KEY:
            params["app_key"] = APP_KEY
            
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    disruptions = res.json()
                    for d in disruptions:
                        desc = str(d.get("description", "")).lower()
                        # Check for triggers indicating crowded/event states
                        if any(word in desc for word in ("crowd", "busy", "congestion", "football", "match", "concert", "stadium", "event")):
                            val = True
                            break
        except Exception as e:
            print(f"Error checking live TfL disruption for {naptan_id}: {e}")
            
        _LIVE_DISRUPTION_CACHE[naptan_id] = (val, time.time() + CACHE_TTL_SECS)
        return val


async def check_live_station_crowding(naptan_id: str) -> bool:
    """
    Query TfL's live crowding API to check if the station is currently congested.
    Utilizes an in-memory TTL cache and asyncio locking to prevent duplicate requests.
    """
    if not naptan_id:
        return False
        
    now = time.time()
    if naptan_id in _LIVE_CROWDING_CACHE:
        val, expiry = _LIVE_CROWDING_CACHE[naptan_id]
        if now < expiry:
            return val
            
    if naptan_id not in _CROWDING_LOCKS:
        _CROWDING_LOCKS[naptan_id] = asyncio.Lock()
        
    async with _CROWDING_LOCKS[naptan_id]:
        # Double-check cache in case another task populated it while we waited
        now = time.time()
        if naptan_id in _LIVE_CROWDING_CACHE:
            val, expiry = _LIVE_CROWDING_CACHE[naptan_id]
            if now < expiry:
                return val
                
        val = False
        url = f"{TFL_BASE}/crowding/{naptan_id}"
        params = {}
        if APP_KEY:
            params["app_key"] = APP_KEY
            
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    live_pct = data.get("liveStatus", {}).get("congestionPercentage", 0.0)
                    if live_pct > 0.70:  # 70% or more indicates high crowds
                         val = True
        except Exception:
            # Fail silently as not all stations have active live crowding feeds
            pass
            
        _LIVE_CROWDING_CACHE[naptan_id] = (val, time.time() + CACHE_TTL_SECS)
        return val


def _is_useless_bus_journey(journey: dict) -> bool:
    for leg in journey.get("legs", []):
        mode = leg.get("mode", "").lower()
        duration = leg.get("duration_mins", 0)
        if mode == "bus" and duration <= 2:
            return True
    return False


async def _parse_journey(journey: dict) -> dict:
    legs  = journey.get("legs", [])
    parsed_legs = [await _parse_leg(leg) for leg in legs]
    
    # Calculate connection waiting times between adjacent legs
    from datetime import datetime
    for idx in range(len(parsed_legs) - 1):
        leg_prev = parsed_legs[idx]
        leg_next = parsed_legs[idx + 1]
        try:
            arr_str = leg_prev.get("arrives_at")
            dep_str = leg_next.get("departs_at")
            if arr_str and dep_str:
                arr_dt = datetime.fromisoformat(arr_str)
                dep_dt = datetime.fromisoformat(dep_str)
                wait_seconds = (dep_dt - arr_dt).total_seconds()
                wait_mins = max(0, int(wait_seconds // 60))
                leg_prev["connection_waiting_mins"] = wait_mins
            else:
                leg_prev["connection_waiting_mins"] = 0
        except Exception:
            leg_prev["connection_waiting_mins"] = 0
            
    if parsed_legs:
        parsed_legs[-1]["connection_waiting_mins"] = 0
 
    modes = list({leg.get("mode", "") for leg in parsed_legs})
    return {
        "source":        "tfl",
        "duration_mins": journey.get("duration", 0),
        "departs_at":    journey.get("startDateTime", ""),
        "arrives_at":    journey.get("arrivalDateTime", ""),
        "changes":       max(len([leg for leg in parsed_legs if leg.get("mode") != "walking"]) - 1, 0),
        "modes":         modes,
        "legs":          parsed_legs,
    }


async def get_routes(
    origin:       str,
    destination:  str,
    time:         str | None = None,
    walking_only: bool = False,
    walking_speed: str | None = None,
) -> list[dict]:
    params: dict = {
        "alternativeWalking": "true",
        "nationalSearch":     "true",
        "maxWalkingMinutes":  "60",
    }
    if APP_KEY:
        params["app_key"] = APP_KEY
        
    if walking_speed:
        params["walkingSpeed"] = walking_speed.capitalize()
        
    if walking_only:
        params["mode"]               = "walking"
        params["walkingOptimization"] = "true"
    if time:
        params["time"] = time

    async def fetch_preference(preference: str, extra_params: dict | None = None) -> list[dict]:
        local_params = params.copy()
        local_params["journeyPreference"] = preference
        if extra_params:
            local_params.update(extra_params)
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                url = f"{TFL_BASE}/Journey/JourneyResults/{origin}/to/{destination}"
                res = await client.get(url, params=local_params)
                if res.status_code == 200:
                    journeys = res.json().get("journeys", [])
                    parsed = []
                    for j in journeys:
                        parsed.append(await _parse_journey(j))
                    return parsed
                
                # Handle 300 Multiple Choices / Disambiguation response
                if res.status_code == 300:
                    data = res.json()
                    new_origin = origin
                    new_dest = destination
                    
                    from_options = data.get("fromLocationDisambiguation", {}).get("disambiguationOptions", [])
                    if from_options:
                        new_origin = from_options[0].get("parameterValue")
                        
                    to_options = data.get("toLocationDisambiguation", {}).get("disambiguationOptions", [])
                    if to_options:
                        new_dest = to_options[0].get("parameterValue")
                        
                    if new_origin != origin or new_dest != destination:
                        retry_url = f"{TFL_BASE}/Journey/JourneyResults/{new_origin}/to/{new_dest}"
                        retry_res = await client.get(retry_url, params=local_params)
                        if retry_res.status_code == 200:
                            journeys = retry_res.json().get("journeys", [])
                            parsed = []
                            for j in journeys:
                                parsed.append(await _parse_journey(j))
                            return parsed
        except Exception as e:
            print(f"Error fetching TfL routes for preference {preference}: {e}")
        return []

    # Parallel queries for LeastTime, LeastInterchange, and a Bus-only preference
    results_least_time, results_least_interchange, results_bus_only = await asyncio.gather(
        fetch_preference("LeastTime"),
        fetch_preference("LeastInterchange"),
        fetch_preference("LeastTime", {"mode": "bus"})
    )
    
    # Combine and de-duplicate based on physical leg signatures to avoid showing
    # multiple schedule variations of the exact same train/line combinations
    combined = []
    seen_sigs = set()
    
    for j in results_least_time + results_least_interchange + results_bus_only:
        leg_sig = tuple((leg.get("mode"), leg.get("line"), leg.get("departure"), leg.get("arrival")) for leg in j.get("legs", []))
        
        if leg_sig not in seen_sigs:
            seen_sigs.add(leg_sig)
            combined.append(j)
            
    # Filter out journeys with short/useless bus legs (<= 2 minutes)
    filtered = [j for j in combined if not _is_useless_bus_journey(j)]
    return filtered


async def get_live_line_disruptions() -> list[dict]:
    """
    Fetch active status disruptions from TfL's Line status feed.
    """
    url = f"{TFL_BASE}/Line/Mode/tube,dlr,overground,elizabeth-line/Status"
    params = {}
    if APP_KEY:
        params["app_key"] = APP_KEY
        
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(url, params=params)
            if res.status_code == 200:
                lines = res.json()
                disruptions = []
                for line in lines:
                    line_name = line.get("name", "")
                    for status in line.get("lineStatuses", []):
                        severity = status.get("statusSeverity", 10)
                        # TfL severity: 10 is Good Service, less than 10 indicates delays/suspensions/etc.
                        if severity < 10:
                            desc = status.get("reason", "")
                            if not desc:
                                desc = f"{line_name} Line: {status.get('statusSeverityDescription', 'Disruption')}"
                            
                            disruptions.append({
                                "line": line_name,
                                "severity": "high" if severity <= 5 else "medium", # 1-5 closures/suspensions, 6-9 delays
                                "description": desc,
                                "status_desc": status.get("statusSeverityDescription", "")
                            })
                return disruptions
    except Exception as e:
        print(f"Error fetching live line disruptions from TfL: {e}")
        
    return []


async def _refresh_live_station_works_task() -> None:
    """
    Background worker that updates the live station works cache from TfL.
    """
    global _LIVE_STATION_WORKS_EXPIRY, _LIVE_STATION_WORKS_CACHE, _IS_REFRESHING_STATION_WORKS
    url = f"{TFL_BASE}/StopPoint/Mode/tube/Disruption"
    params = {}
    if APP_KEY:
        params["app_key"] = APP_KEY

    stations = set()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url, params=params)
            if res.status_code == 200:
                disruptions = res.json()
                keywords = [
                    "drill", "construction", "engineering", 
                    "refurbishment", "renovation", "building works", 
                    "maintenance", "vibration", "streetworks", "outside",
                    "upgrade", "modernisation"
                ]
                for d in disruptions:
                    desc = str(d.get("description", "")).lower()
                    if any(kw in desc for kw in keywords):
                        name = d.get("commonName", "")
                        if name:
                            name = name.replace(" Underground Station", "")
                            name = name.replace(" Station", "")
                            name = name.strip()
                            if name:
                                stations.add(name)
                _LIVE_STATION_WORKS_CACHE = sorted(list(stations))
    except Exception as e:
        print(f"Error background fetching live station works: {e}")
    finally:
        _LIVE_STATION_WORKS_EXPIRY = time.time() + CACHE_TTL_SECS
        _IS_REFRESHING_STATION_WORKS = False


async def get_live_station_works() -> list[str]:
    """
    Return active station disruptions from memory immediately. If cache is expired,
    fire a background refresh task so the user request remains instant.
    """
    global _LIVE_STATION_WORKS_EXPIRY, _IS_REFRESHING_STATION_WORKS
    now = time.time()
    if now >= _LIVE_STATION_WORKS_EXPIRY and not _IS_REFRESHING_STATION_WORKS:
        _IS_REFRESHING_STATION_WORKS = True
        asyncio.create_task(_refresh_live_station_works_task())
        
    return _LIVE_STATION_WORKS_CACHE


_LIVE_STATION_EVENTS_CACHE: list[dict[str, str]] = []
_LIVE_STATION_EVENTS_EXPIRY: float = 0.0
_STATION_EVENTS_LOCK = asyncio.Lock()
_IS_REFRESHING_STATION_EVENTS: bool = False


async def _refresh_live_station_events_task() -> None:
    """Background task to fetch and filter live stadium and crowd events from TfL."""
    global _LIVE_STATION_EVENTS_EXPIRY, _LIVE_STATION_EVENTS_CACHE, _IS_REFRESHING_STATION_EVENTS
    url = f"{TFL_BASE}/StopPoint/Mode/tube,dlr,overground,elizabeth-line/Disruption"
    params = {}
    if APP_KEY:
        params["app_key"] = APP_KEY

    events = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url, params=params)
            if res.status_code == 200:
                disruptions = res.json()
                keywords = ["crowd", "busy", "congestion", "football", "match", "concert", "stadium", "event"]
                for d in disruptions:
                    desc = str(d.get("description", ""))
                    desc_lower = desc.lower()
                    if any(kw in desc_lower for kw in keywords):
                        name = d.get("commonName", "")
                        if name:
                            # Clean up station name suffixes
                            name = name.replace(" Underground Station", "")
                            name = name.replace(" DLR Station", "")
                            name = name.replace(" Railway Station", "")
                            name = name.replace(" Rail Station", "")
                            name = name.replace(" Station", "")
                            name = name.strip()
                            if name:
                                events.append({
                                    "station": name,
                                    "desc": desc
                                })
                _LIVE_STATION_EVENTS_CACHE = events
    except Exception as e:
        print(f"Error background fetching live station events: {e}")
    finally:
        _LIVE_STATION_EVENTS_EXPIRY = time.time() + CACHE_TTL_SECS
        _IS_REFRESHING_STATION_EVENTS = False


async def get_live_station_events() -> list[dict[str, str]]:
    """Return active station crowd and event alerts from cache, refreshing asynchronously if stale."""
    global _LIVE_STATION_EVENTS_EXPIRY, _IS_REFRESHING_STATION_EVENTS
    now = time.time()
    if now >= _LIVE_STATION_EVENTS_EXPIRY and not _IS_REFRESHING_STATION_EVENTS:
        _IS_REFRESHING_STATION_EVENTS = True
        asyncio.create_task(_refresh_live_station_events_task())
        
    return _LIVE_STATION_EVENTS_CACHE

