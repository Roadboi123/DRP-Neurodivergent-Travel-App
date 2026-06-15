import httpx
import os
import time
import asyncio
import json
import logging

logger = logging.getLogger(__name__)

TFL_BASE = "https://api.tfl.gov.uk"
APP_KEY  = os.environ.get("TFL_APP_KEY", "")

# ---------------------------------------------------------------------------
# Rate-limit handler for the TfL API.
#
# TfL throttles unregistered/low-tier keys (HTTP 429). Two guards:
#   1. An app-wide semaphore caps how many TfL requests we have in flight at
#      once (a burst of route + crowding + disruption calls can otherwise fan
#      out to dozens of simultaneous requests and trip the limit).
#   2. On a 429 we back off (honouring `Retry-After` when present) and retry a
#      couple of times before giving up, so transient throttling self-heals
#      instead of surfacing as a failed route lookup.
# Every outbound TfL GET in this module goes through `tfl_get`.
# ---------------------------------------------------------------------------
_TFL_MAX_CONCURRENCY = int(os.environ.get("TFL_MAX_CONCURRENCY", "8"))
_TFL_SEMAPHORE = asyncio.Semaphore(_TFL_MAX_CONCURRENCY)
_TFL_MAX_RETRIES = int(os.environ.get("TFL_MAX_RETRIES", "2"))
_TFL_BACKOFF_CAP_SECS = 5.0


async def tfl_get(
    client: httpx.AsyncClient,
    url: str,
    *,
    params: dict | None = None,
    retries: int = _TFL_MAX_RETRIES,
) -> httpx.Response:
    """GET a TfL endpoint with app-wide concurrency limiting + 429 backoff.

    Returns the final `httpx.Response` (the caller still checks `status_code`).
    Network errors propagate to the caller's existing try/except as before.
    """
    attempt = 0
    while True:
        async with _TFL_SEMAPHORE:
            res = await client.get(url, params=params)
        if res.status_code == 429 and attempt < retries:
            retry_after = res.headers.get("Retry-After")
            try:
                delay = float(retry_after) if retry_after else 0.5 * (2 ** attempt)
            except ValueError:
                delay = 0.5 * (2 ** attempt)
            delay = min(delay, _TFL_BACKOFF_CAP_SECS)
            logger.warning("TfL rate limited (429) on %s; backing off %.1fs (attempt %d)", url, delay, attempt + 1)
            await asyncio.sleep(delay)
            attempt += 1
            continue
        return res

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



def clean_station_name(name: str) -> str:
    n = name.lower()
    for suffix in [" underground station", " railway station", " rail station", " dlr station", " station"]:
        if n.endswith(suffix):
            n = n[:-len(suffix)]
    return n.strip()


def get_gwml_path(dep_name: str, arr_name: str) -> list[list[float]] | None:
    stations_ordered = [
        "reading", "twyford", "maidenhead", "taplow", "burnham", "slough",
        "langley", "iver", "west drayton", "hayes & harlington", "southall",
        "hanwell", "west ealing", "ealing broadway", "acton main line", "paddington"
    ]
    
    station_coords = {
        "reading": [51.458786, -0.971849],
        "twyford": [51.475534, -0.863293],
        "maidenhead": [51.518305, -0.722253],
        "taplow": [51.523402, -0.681505],
        "burnham": [51.523506, -0.646374],
        "slough": [51.51202, -0.591924],
        "langley": [51.507712, -0.541104],
        "iver": [51.508503, -0.506726],
        "west drayton": [51.509829, -0.47217],
        "hayes & harlington": [51.502935, -0.420113],
        "southall": [51.505987, -0.377543],
        "hanwell": [51.511888, -0.338524],
        "west ealing": [51.513411, -0.322313],
        "ealing broadway": [51.514643, -0.30173],
        "acton main line": [51.516747, -0.269684],
        "paddington": [51.516995, -0.177388],
    }
    
    def clean(name: str) -> str:
        n = name.lower()
        for suffix in [" underground station", " railway station", " rail station", " dlr station", " station"]:
            if n.endswith(suffix):
                n = n[:-len(suffix)]
        n = n.replace(" (berks)", "")
        n = n.replace("london ", "")
        return n.strip()
        
    dep_clean = clean(dep_name)
    arr_clean = clean(arr_name)
    
    if dep_clean in stations_ordered and arr_clean in stations_ordered:
        i = stations_ordered.index(dep_clean)
        j = stations_ordered.index(arr_clean)
        if i == j:
            return [[station_coords[dep_clean][0], station_coords[dep_clean][1]]]
        if i < j:
            path_names = stations_ordered[i:j+1]
            return [station_coords[name] for name in path_names]
        else:
            path_names = stations_ordered[j:i+1]
            coords = [station_coords[name] for name in path_names]
            coords.reverse()
            return coords
            
    return None


def _parse_leg(leg: dict) -> dict:
    # Resolve geometry from lineString
    path_coords = []
    line_string_str = leg.get("path", {}).get("lineString")
    if line_string_str:
        try:
            import math as _math

            raw_coords = json.loads(line_string_str)

            # ----------------------------------------------------------------
            # Clean-up pass: the TfL lineString for long rail legs (e.g.
            # Elizabeth line) often contains geometry for BOTH the eastbound
            # and westbound tracks, producing a zig-zag that wanders off the
            # actual route on the map.  We apply two successive filters:
            #
            # 1. Step-distance guard — drop any point that teleports more
            #    than 3 000 m from the previous kept point (rare TfL artifact).
            #
            # 2. Monotonic-progress filter — project each point onto the
            #    departure → arrival axis and discard any point that moves
            #    MORE THAN 150 m backwards along that axis relative to the
            #    last accepted point.  Legitimate curves always make forward
            #    progress; only the duplicate-track zig-zags go backwards.
            # ----------------------------------------------------------------

            dep_lat = leg.get("departurePoint", {}).get("lat") or 0.0
            dep_lon = leg.get("departurePoint", {}).get("lon") or 0.0
            arr_lat = leg.get("arrivalPoint", {}).get("lat") or 0.0
            arr_lon = leg.get("arrivalPoint", {}).get("lon") or 0.0

            # Build a unit vector in approximate flat-earth coords.
            # Scale longitude by cos(mid-lat) so degrees are comparable.
            cos_lat = _math.cos(_math.radians((dep_lat + arr_lat) / 2))
            ax = (arr_lat - dep_lat)
            ay = (arr_lon - dep_lon) * cos_lat
            a_len = _math.sqrt(ax * ax + ay * ay) or 1.0
            # Unit vector along dep→arr
            ux, uy = ax / a_len, ay / a_len
            # Degrees → metres scaling (approximate)
            deg_to_m = 111_320.0

            def _progress(pt):
                """Signed projection of pt onto dep→arr axis, in metres."""
                dx = pt[0] - dep_lat
                dy = (pt[1] - dep_lon) * cos_lat
                return (dx * ux + dy * uy) * deg_to_m

            def _step_m(a, b):
                R = 6_371_000
                p1 = _math.radians(a[0])
                p2 = _math.radians(b[0])
                dp = _math.radians(b[0] - a[0])
                dl = _math.radians(b[1] - a[1])
                s = _math.sin(dp/2)**2 + _math.cos(p1)*_math.cos(p2)*_math.sin(dl/2)**2
                return 2 * R * _math.atan2(_math.sqrt(s), _math.sqrt(1 - s))

            STEP_LIMIT   = 3_000   # metres — teleport guard
            BACK_LIMIT   = 150     # metres — backwards-progress tolerance

            filtered: list = []
            max_progress = float("-inf")

            for pt in raw_coords:
                # Guard 1: step-distance
                if filtered and _step_m(filtered[-1], pt) > STEP_LIMIT:
                    continue
                # Guard 2: monotonic progress
                prog = _progress(pt)
                if prog < max_progress - BACK_LIMIT:
                    continue
                max_progress = max(max_progress, prog)
                filtered.append(pt)

            path_coords = filtered
        except Exception as e:
            print(f"Error parsing TfL lineString: {e}")

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

    mode_name = leg.get("mode", {}).get("name", "unknown")
    line_name = leg.get("routeOptions", [{}])[0].get("lineIdentifier", {}).get("name", "") if leg.get("routeOptions") else ""
    
    dep_lat = leg.get("departurePoint", {}).get("lat")
    dep_lon = leg.get("departurePoint", {}).get("lon")
    arr_lat = leg.get("arrivalPoint", {}).get("lat")
    arr_lon = leg.get("arrivalPoint", {}).get("lon")

    # Override path and endpoints if this is a rail service along the Great Western Main Line
    mode_lower = mode_name.lower()
    line_lower = line_name.lower()
    is_gwml = (
        "elizabeth" in line_lower or
        "elizabeth" in mode_lower or
        "great western" in line_lower or
        "gwr" in line_lower or
        "national-rail" in mode_lower or
        "national rail" in mode_lower
    )
    if is_gwml:
        gwml_path = get_gwml_path(departure, arrival)
        if gwml_path is not None:
            path_coords = gwml_path
            dep_lat, dep_lon = path_coords[0][0], path_coords[0][1]
            arr_lat, arr_lon = path_coords[-1][0], path_coords[-1][1]

    return {
        "mode":          mode_name,
        "departure":     departure,
        "arrival":       arrival,
        "departure_naptan": leg.get("departurePoint", {}).get("naptanId", ""),
        "arrival_naptan":   leg.get("arrivalPoint", {}).get("naptanId", ""),
        "departure_lat":    dep_lat,
        "departure_lon":    dep_lon,
        "arrival_lat":      arr_lat,
        "arrival_lon":      arr_lon,
        "departs_at":    leg.get("departureTime", ""),
        "arrives_at":    leg.get("arrivalTime", ""),
        "duration_mins": leg.get("duration", 0),
        "instruction":   leg.get("instruction", {}).get("summary", ""),
        "line":          line_name,
        "stops":         stops,
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
                res = await tfl_get(client, url, params=params)
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
                res = await tfl_get(client, url, params=params)
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
    date:         str | None = None,
    time_is:      str | None = None,
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
    # TfL plans for "now" unless given a date (yyyyMMdd) + time (HHmm); timeIs
    # selects whether that instant is the departure or the arrival deadline.
    if time:
        params["time"] = time
    if date:
        params["date"] = date
    if time_is:
        params["timeIs"] = time_is

    async def fetch_preference(preference: str, extra_params: dict | None = None) -> list[dict]:
        local_params = params.copy()
        local_params["journeyPreference"] = preference
        if extra_params:
            local_params.update(extra_params)
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                url = f"{TFL_BASE}/Journey/JourneyResults/{origin}/to/{destination}"
                res = await tfl_get(client, url, params=local_params)
                if res.status_code == 200:
                    return [_parse_journey(j) for j in res.json().get("journeys", [])]
                
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
                        retry_res = await tfl_get(client, retry_url, params=local_params)
                        if retry_res.status_code == 200:
                            return [_parse_journey(j) for j in retry_res.json().get("journeys", [])]
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
            res = await tfl_get(client, url, params=params)
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
            res = await tfl_get(client, url, params=params)
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
            res = await tfl_get(client, url, params=params)
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

