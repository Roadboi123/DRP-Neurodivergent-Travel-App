import httpx
import os
import time
import asyncio

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


def _parse_leg(leg: dict) -> dict:
    return {
        "mode":          leg.get("mode", {}).get("name", "unknown"),
        "departure":     leg.get("departurePoint", {}).get("commonName", ""),
        "arrival":       leg.get("arrivalPoint", {}).get("commonName", ""),
        "departure_naptan": leg.get("departurePoint", {}).get("naptanId", ""),
        "arrival_naptan":   leg.get("arrivalPoint", {}).get("naptanId", ""),
        "departure_lat":    leg.get("departurePoint", {}).get("lat"),
        "departure_lon":    leg.get("departurePoint", {}).get("lon"),
        "arrival_lat":      leg.get("arrivalPoint", {}).get("lat"),
        "arrival_lon":      leg.get("arrivalPoint", {}).get("lon"),
        "departs_at":    leg.get("departureTime", ""),
        "arrives_at":    leg.get("arrivalTime", ""),
        "duration_mins": leg.get("duration", 0),
        "instruction":   leg.get("instruction", {}).get("summary", ""),
        "line":          leg.get("routeOptions", [{}])[0]
                            .get("lineIdentifier", {})
                            .get("name", "") if leg.get("routeOptions") else "",
        "stops":         [sp.get("name") for sp in leg.get("path", {}).get("stopPoints", [])],
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


def _parse_journey(journey: dict) -> dict:
    legs  = journey.get("legs", [])
    parsed_legs = [_parse_leg(leg) for leg in legs]
    
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
                res = await client.get(
                    f"{TFL_BASE}/Journey/JourneyResults/{origin}/to/{destination}",
                    params=local_params,
                )
                if res.status_code == 200:
                    return [_parse_journey(j) for j in res.json().get("journeys", [])]
        except Exception as e:
            print(f"Error fetching TfL routes for preference {preference}: {e}")
        return []

    # Parallel queries for LeastTime, LeastInterchange, and a Bus-only preference
    results_least_time, results_least_interchange, results_bus_only = await asyncio.gather(
        fetch_preference("LeastTime"),
        fetch_preference("LeastInterchange"),
        fetch_preference("LeastTime", {"mode": "bus"})
    )
    
    # Combine and de-duplicate based on departs_at, arrives_at and leg signatures
    combined = []
    seen_keys = set()
    
    for j in results_least_time + results_least_interchange + results_bus_only:
        leg_sig = tuple((leg.get("mode"), leg.get("line"), leg.get("departure"), leg.get("arrival")) for leg in j.get("legs", []))
        key = (j.get("departs_at"), j.get("arrives_at"), leg_sig)
        
        if key not in seen_keys:
            seen_keys.add(key)
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